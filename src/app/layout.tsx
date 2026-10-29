import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const serif = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-newsreader" });
const sans = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Claude Summary Studio",
  description: "Summarize text, PDF, Word and data files to an exact word count, or let AI decide, then export to PDF, Word, Text or Markdown.",
};

// Apply the saved or system theme before first paint, so the page never flashes the wrong theme.
const themeScript = `try{document.documentElement.dataset.theme=localStorage.getItem("summary-studio:theme")||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
