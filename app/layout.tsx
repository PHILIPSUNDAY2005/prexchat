import ServiceWorkerRegister from "./ServiceWorkerRegister";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SplashScreen from "./SplashScreen";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChitChat NG",
  description: "Every gist, every day.",
  manifest: "/manifest.json",
  themeColor: "#0B1120",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ChitChat NG",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
            <head>
        <meta name="color-scheme" content="light" />
      </head>
  <body className="min-h-full flex flex-col">
  <ServiceWorkerRegister />
  <SplashScreen />
  {children}
  <script
    src="https://challenges.cloudflare.com/turnstile/v0/api.js"
    async
    defer
  ></script>
</body>
    </html>
  );
}