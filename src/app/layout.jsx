import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata = {
  title: "FireWatch India — Satellite Fire & Crop Burning Monitoring",
  description:
    "Administrative platform for monitoring NASA FIRMS satellite fire detections, assigning field investigations and tracking crop burning incidents across districts.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen bg-[#05080e] font-sans text-slate-200 antialiased">{children}</body>
    </html>
  );
}
