import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HomeMint — A little clarity. A happier home.',
  description:
    'A calmer way to manage your family’s money. Plan budgets, share expenses, and grow your dreams together.',
  applicationName: 'HomeMint',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#28705b' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
