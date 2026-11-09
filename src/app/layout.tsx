import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coachlab",
  description:
    "Trainingsplattform für Fussballvereine: Philosophie, Übungen, Videos und Webinare.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de-CH" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
