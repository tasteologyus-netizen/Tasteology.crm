import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { AuthProvider } from "@/lib/auth";
import { AuthGate } from "@/components/AuthGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tasteology & Co · CRM",
  description: "Leads, clients, freelancers and project accounting for Tasteology & Co.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#275b45",
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
      <body className="min-h-full">
        <AuthProvider>
          <AuthGate>
            <div className="flex min-h-screen flex-col lg:flex-row">
              <Sidebar />
              <main className="min-w-0 flex-1 overflow-x-hidden pb-20 lg:pb-0">
                {children}
              </main>
            </div>
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
