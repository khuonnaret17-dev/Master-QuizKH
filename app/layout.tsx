import type { Metadata, Viewport } from "next";
import "./globals.css";
import { FirebaseProvider } from "@/lib/FirebaseProvider";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "កម្មវិធីត្រៀមប្រឡងក្របខ័ណ្ឌ",
  description: "An application providing information and quizzes about various Cambodian ministries, including logos and descriptions.",
  icons: {
    icon: "/app-logo.jpg",
    shortcut: "/app-logo.jpg",
    apple: "/app-logo.jpg",
  },
  openGraph: {
    title: "កម្មវិធីត្រៀមប្រឡងក្របខ័ណ្ឌ",
    description: "An application providing information and quizzes about various Cambodian ministries, including logos and descriptions.",
    images: [{ url: "/app-logo.jpg", width: 500, height: 500, alt: "App Logo" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="km" className="overflow-x-hidden">
      <body className="antialiased overflow-x-hidden max-w-full">
        <Suspense fallback={null}>
          <FirebaseProvider>
            {children}
          </FirebaseProvider>
        </Suspense>
      </body>
    </html>
  );
}
