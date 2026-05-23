import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AgentCorp - AI Office Simulation',
  description: 'Retro-styled 2D AI office simulation with autonomous agents',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
