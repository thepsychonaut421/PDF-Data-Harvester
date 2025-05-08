import type {Metadata} from 'next';
import { Inter } from 'next/font/google'; // Using Inter as a common, clean sans-serif font
import './globals.css';

// const geistSans = Geist({
//   variable: '--font-geist-sans',
//   subsets: ['latin'],
// });

// const geistMono = Geist_Mono({
//   variable: '--font-geist-mono',
//   subsets: ['latin'],
// });

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans', // Using a more generic variable name
});


export const metadata: Metadata = {
  title: 'PDF Data Harvester',
  description: 'Extrage date din fișiere PDF și le organizează.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro" suppressHydrationWarning> {/* Added suppressHydrationWarning for themeing */}
      <body className={`${inter.variable} font-sans antialiased`}> {/* Use the font variable and apply antialiasing */}
        {children}
      </body>
    </html>
  );
}
