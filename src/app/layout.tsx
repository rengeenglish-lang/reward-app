import type { Metadata } from 'next';
import { Fredoka, Nunito } from 'next/font/google';
import './globals.css';

const rounded = Nunito({ subsets: ['latin'], weight: 'variable', variable: '--font-rounded', display: 'swap' });
const playful = Fredoka({ subsets: ['latin'], weight: 'variable', variable: '--font-playful', display: 'swap' });

export const metadata: Metadata = {
  title: 'Ezgili Champs · Classroom rewards',
  description: 'A cheerful classroom rewards dashboard for growing minds.',
  icons: {
    icon: [
      { url: '/favicon.ico?v=20261004-2', type: 'image/x-icon', sizes: 'any' },
    ],
    apple: '/brand/ezgili-champs-mascot.png?v=20261004-2',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${rounded.variable} ${playful.variable}`}><body>{children}</body></html>;
}
