import type { Metadata } from "next";
import localFont from "next/font/local";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { shouldEnableSpeedInsights } from "@/lib/speedInsights";
import "./globals.css";

export const metadata: Metadata = {
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION ?? "",
    other: {
      "naver-site-verification": ["afc03764065e625bf0d5757f0060d532b9854641"],
    },
  },
};

const pretendard = localFont({
  src: "../fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
  weight: "100 900",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${pretendard.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
          {shouldEnableSpeedInsights() ? <SpeedInsights /> : null}
        </ThemeProvider>
      </body>
    </html>
  );
}
