import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Lumière POS | Enterprise Restaurant System',
  description: 'Premium Restaurant Management System',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className="antialiased">
      <body className={`${inter.variable} font-sans bg-[#F4F4F6] dark:bg-[#0A0A0C] text-slate-900 dark:text-slate-100 min-h-screen selection:bg-orange-500/30`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
