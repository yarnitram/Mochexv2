import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOCHEX - MEXC Technical Analysis & Charting Platform",
  description: "Client-centric technical analysis workstation for MEXC Spot markets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground antialiased h-screen w-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
