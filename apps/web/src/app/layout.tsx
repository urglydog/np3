import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { QueryProvider } from '@/components/query-provider';
import { BottomNav } from '@/components/bottom-nav';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Roadmap Planner',
  description: 'Lộ trình học tự tính lịch, nhắc học và nhắc mua sách.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Roadmap Planner',
  },
  icons: {
    apple: '/icons/icon-192-v2.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#ef4a6d',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-surface text-ink">
        <QueryProvider>
          <div className="flex-1 pb-[max(env(safe-area-inset-bottom),0.5rem)]">{children}</div>
          <BottomNav />
        </QueryProvider>
      </body>
    </html>
  );
}
