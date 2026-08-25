import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polyphonic Web Synthesizer",
  description: "A 10-voice polyphonic synthesizer built on the native Web Audio API.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
