import type { Metadata } from "next";
import "@/styles/globals.css";
import { ThemeProvider } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Datum — Codebase Flaw Scanner",
  description:
    "Scan a GitHub codebase for security flaws, bugs and TODOs, with the exact line and how to fix each one.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body className="min-h-screen bg-bg text-text antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
