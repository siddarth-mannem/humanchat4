import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'HumanChat',
  description: 'Concierge workspace for Sam and human hosts'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
