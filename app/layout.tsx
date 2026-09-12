import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import TrackerApp from './tracker-app';
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
  applicationName: 'McGillTrack',
  title: 'McGillTrack',
  description:
    'A private-by-default academic tracker for assignments, schedules, notes, friends, focus time, and comfort pictures.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'McGillTrack',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/assets/rabbit-cute.png', type: 'image/png' },
      { url: '/assets/pwa-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/assets/pwa-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/assets/rabbit-cute.png',
    apple: [
      { url: '/assets/pwa-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/assets/pwa-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#dbeafe',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TrackerApp />
        <div className="hidden">{children}</div>
      </body>
    </html>
  );
}
