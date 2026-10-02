import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'BrightSteps · Classroom rewards', description: 'A cheerful classroom progress dashboard for tutors.' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
