import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dine In | Restaurant POS",
  description: "Touch-friendly restaurant point of sale and table management.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
