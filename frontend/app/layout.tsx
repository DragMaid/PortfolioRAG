import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/* Italic is used for the timeline captions. */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Software engineering portfolio.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${newsreader.variable} ${jetBrainsMono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="flex min-h-full flex-col bg-warm-bg font-sans text-warm-black selection:bg-warm-accent/20 selection:text-warm-black">
        {children}
      </body>
    </html>
  );
}
