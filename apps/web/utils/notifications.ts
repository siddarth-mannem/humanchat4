"use client";

const FIVE_MINUTES = 5 * 60 * 1000;

const getRegistration = async () => {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch (error) {
    console.warn('Service worker not ready', error);
    return null;
  }
};

export const initializeNotifications = async () => {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) {
    console.warn('Notifications not supported');
    return false;
  }
  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch (error) {
      console.warn('Notification permission request failed', error);
    }
  }
  return Notification.permission === 'granted';
};

const showNotification = async (title: string, body: string, data?: Record<string, unknown>, tag?: string) => {
  const registration = await getRegistration();
  if (registration && Notification.permission === 'granted') {
    await registration.showNotification(title, {
      body,
      tag,
      data,
      icon: '/icon.svg',
      badge: '/icon.svg'
    });
  }
};

export const notifyNewMessage = async (conversationTitle: string, preview: string) => {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    return;
  }
  await showNotification(`New message from ${conversationTitle}`, preview, { type: 'message' }, `message-${conversationTitle}`);
};

export const notifyPaymentComplete = async (amount: number, currency: string) => {
  const formatted = new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount / 100);
  await showNotification('Payment complete', `${formatted} captured successfully.`, { type: 'payment' }, 'payment');
};

export const scheduleCallReminder = async (startTime: number, hostName: string) => {
  const fireAt = Math.max(0, startTime - FIVE_MINUTES);
  const delay = fireAt - Date.now();
  const trigger = async () => {
    await showNotification('Session starting soon', `${hostName} joins in 5 minutes.`, { type: 'call_reminder', hostName, startTime });
  };
  if (delay <= 0) {
    await trigger();
    return;
  }
  window.setTimeout(() => {
    void trigger();
  }, delay);
};

export const notifyPushEvent = async (title: string, body: string, data?: Record<string, unknown>) => {
  await showNotification(title, body, data);
};
