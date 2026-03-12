import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/providers/app-provider";
import { ClerkProvider } from "@clerk/nextjs";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rostering System CRM",
  description: "Fleet management and rostering system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${inter.variable}  antialiased`}>
          <AppProviders>
            <div className="flex min-h-screen">
              <main className="flex-1 overflow-auto">{children}</main>
            </div>
          </AppProviders>
        </body>
      </html>
    </ClerkProvider>
  );
}
