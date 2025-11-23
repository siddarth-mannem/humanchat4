import { expect, Page, test } from '@playwright/test';
import type { BootstrapPayload } from '../src/lib/db';

const bootstrapSeed: BootstrapPayload = {
  conversations: [
    {
      conversationId: 'sam-concierge',
      type: 'sam',
      participants: ['sam', 'demo-user'],
      lastActivity: Date.now(),
      unreadCount: 0
    },
    {
      conversationId: 'mentor-1',
      type: 'human',
      participants: ['demo-user', 'River Product'],
      lastActivity: Date.now() - 5000,
      unreadCount: 1
    }
  ],
  messages: [
    {
      id: 1,
      conversationId: 'sam-concierge',
      senderId: 'sam',
      content: 'Hey there! Ready to plan your next chat?',
      timestamp: Date.now() - 10_000,
      type: 'sam_response'
    }
  ]
};

const mockSlots = [
  {
    id: 'slot-1',
    start: '2025-12-01T18:00:00Z',
    end: '2025-12-01T18:30:00Z',
    status: 'open'
  }
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ seed }) => {
    window.__HUMANCHAT_BOOTSTRAP__ = seed;
    const bootstrapWindow = window as typeof window & { Notification?: typeof Notification };
    if (!('Notification' in bootstrapWindow)) {
      const MockNotification = class {
        static permission: NotificationPermission = 'granted';
        static async requestPermission() {
          return 'granted' as NotificationPermission;
        }
        constructor(_title: string, _options?: NotificationOptions) {}
      } as unknown as typeof Notification;
      bootstrapWindow.Notification = MockNotification;
    }
  }, { seed: bootstrapSeed });

  await page.route('**/api/sam/chat**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        text: 'Here are a few options for you.',
        actions: [
          {
            type: 'show_profiles',
            profiles: [
              {
                userId: 'mentor-9',
                name: 'Jordan Mentor',
                conversationType: 'paid',
                instantRatePerMinute: 15,
                isOnline: true,
                hasActiveSession: false
              }
            ]
          }
        ]
      })
    });
  });

  await page.route('**/api/calendar/availability**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ slots: mockSlots })
    });
  });

  await page.route('**/api/sessions', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ session: { sessionId: 'session-55' } })
    });
  });

  await page.route('**/api/payments/**', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ intent: { id: 'pi-test' } }) });
  });
});

const getTextarea = (page: Page) => page.getByPlaceholder('Message Sam...');

test('Sam concierge suggests profiles and booking completes', async ({ page }) => {
  await page.goto('/chat');

  await page.getByRole('button', { name: /sam concierge/i }).click();
  await expect(getTextarea(page)).toBeVisible();

  await getTextarea(page).fill('Book a PM mentor for next week.');
  await page.getByRole('button', { name: /^send$/i }).click();

  // Sidebar previews also echo this copy, so pin to the in-thread bubble.
  await expect(page.getByText(/here are a few options/i).nth(1)).toBeVisible();
  const connectButton = page.getByRole('button', { name: /connect now/i }).first();
  await expect(connectButton).toBeEnabled();

  const bookButton = page.getByRole('button', { name: /book time/i }).first();
  await bookButton.click();

  const selectSlotButton = page.getByRole('button', { name: /^select$/i }).first();
  await expect(selectSlotButton).toBeVisible();
  await selectSlotButton.click();
  await page.getByRole('button', { name: /confirm booking/i }).click();

  await expect(page.getByText(/we need your account info/i)).toBeVisible();
});
