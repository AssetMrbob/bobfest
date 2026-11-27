import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kampung Inggris Fess — Tell ur untold story!",
  description: "An anonymous community platform for Kampung Inggris students, alumni, visitors, and locals. Managed by Mr.BOB Kampung Inggris.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Kampung Inggris Fess — Tell ur untold story!",
    description: "An anonymous community platform for Kampung Inggris students, alumni, visitors, and locals. Managed by Mr.BOB Kampung Inggris.",
    url: "https://www.instagram.com/kampunginggrisfess/",
    siteName: "Kampung Inggris Fess",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kampung Inggris Fess",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#FFFFFF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-dvh bg-[#FFFFFF] text-[#171717] antialiased flex flex-col font-sans overflow-x-hidden selection:bg-[#2563EB] selection:text-[#FFFFFF]">
        {children}
      </body>
    </html>
  );
}
