import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./dashboard.css";

export const metadata: Metadata = {
  title: "냉이랑 루틴",
  description: "개인 맞춤 다이어트 루틴 트래커",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "냉이랑 루틴"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
