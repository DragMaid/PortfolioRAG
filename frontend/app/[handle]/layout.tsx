import { Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";

/*
 * The portfolio's own type, scoped to `/[handle]` and its posts so the studio and the landing
 * page keep theirs. Hanken Grotesk is a warmer, rounder grotesk than Inter at the small sizes
 * the cards run at; Plex Mono is quieter than JetBrains Mono for dates, handles and counts.
 * The serif stays Newsreader, loaded by the root layout.
 */
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export default function PortfolioLayout({ children }: LayoutProps<"/[handle]">) {
  return (
    <div className={`${hanken.variable} ${plexMono.variable} portfolio-type flex flex-1 flex-col`}>
      {children}
    </div>
  );
}
