import './globals.css';
import type { ReactNode } from 'react';
import { Inter, Space_Grotesk } from 'next/font/google';
import PWAInitializer from '../components/PWAInitializer';
import FirebaseSessionBridge from '../components/FirebaseSessionBridge';
import IdentityInitializer from '../components/IdentityInitializer';

export const metadata = {
  title: 'HumanChat — Talk to Anyone, About Anything',
  description: 'Meet Sam, your AI concierge who connects you with real human experts in seconds.'
};

const inter = Inter({ subsets: ['latin'], variable: '--font-body' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="bg-midnight text-white font-body antialiased">
        <PWAInitializer />
        <FirebaseSessionBridge />
        <IdentityInitializer />
        {children}
      </body>
    </html>
  );
}
