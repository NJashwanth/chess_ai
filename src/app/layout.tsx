import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Chess Benchmark: Jev vs Fable",
  description:
    "Two AI models play their own game against identical Stockfish opponents, side by side, scored on results, move quality, speed and cost.",
};

// Applies the stored theme before first paint so the page never flashes.
const themeScript = `
try {
  var t = localStorage.getItem('chess-benchmark-theme');
  if (t === 'dark') document.documentElement.classList.add('dark');
  if (t === 'light') document.documentElement.classList.add('light');
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
