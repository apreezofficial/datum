import type { Metadata } from "next";
import "@/styles/globals.css";
import { ThemeProvider } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Datum — Design System Drift & Auto-Fix",
  description:
    "Survey any GitHub codebase or Figma file against design system benchmarks, map UI drift, and open safe autofix pull requests.",
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
