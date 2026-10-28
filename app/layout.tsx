import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import Frame from "@/components/Frame";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Anek Devanagari (Ek Type, SIL OFL) pairs with Geist. Devanagari sits small next to Latin at the same size,
// so its glyphs are scaled up 12% inside the font face; English and numbers are untouched.
const deva = localFont({
  src: "./fonts/anek-devanagari.woff2", weight: "100 800", variable: "--font-deva", display: "swap",
  declarations: [
    { prop: "size-adjust", value: "112%" },
    { prop: "unicode-range", value: "U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+20A8, U+20B9, U+25CC, U+A830-A839, U+A8E0-A8FF" },
  ],
});

export const metadata: Metadata = {
  title: "BodyMap — your body, explained",
  description: "Upload prescriptions, blood reports, X-rays, MRIs and ultrasounds. Every finding is pinned to your body and explained in plain language.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${deva.variable} h-full antialiased`}>
      <body className="h-full font-sans">
        <Frame>{children}</Frame>
      </body>
    </html>
  );
}
