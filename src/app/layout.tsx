import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { SiteHeader } from "@/components/SiteHeader";
import { buildNav } from "@/lib/content";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "InterviewForge — visual interview prep",
    template: "%s · InterviewForge",
  },
  description:
    "Learn DSA, system design and the rest of the interview loop through visual animations, worked examples and diagrams.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const nav = buildNav();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader nav={nav} />
        {children}
      </body>
    </html>
  );
}
