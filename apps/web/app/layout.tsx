import './globals.css';
import type { ReactNode } from 'react';
import { Inter, Space_Grotesk } from 'next/font/google';
import PWAInitializer from '../components/PWAInitializer';
import FirebaseSessionBridge from '../components/FirebaseSessionBridge';
import IdentityInitializer from '../components/IdentityInitializer';
import InstantInviteListener from '../components/InstantInviteListener';
import InstantInviteNavigator from '../components/InstantInviteNavigator';
import UserSettingsMenu from '../components/UserSettingsMenu';

export const metadata = {
  title: 'HumanChat — Talk to Anyone, About Anything',
  description: 'Meet Sam, your AI concierge who connects you with real human experts in seconds.'
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover'
};

const inter = Inter({ subsets: ['latin'], variable: '--font-body' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="bg-midnight text-white font-body antialiased min-h-screen overflow-x-hidden">
        <PWAInitializer />
        <FirebaseSessionBridge />
        <IdentityInitializer />
        <InstantInviteListener />
        <InstantInviteNavigator />
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-end px-4 py-4 chat-layout-settings">
          <div className="pointer-events-auto">
            <UserSettingsMenu />
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
