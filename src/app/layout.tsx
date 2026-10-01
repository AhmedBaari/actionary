import type { Metadata } from "next";
import type { Viewport } from "next";
import { Outfit, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SastraNet",
  description: "Let's Do The Impossible Together",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${outfit.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable} h-full scroll-smooth`}
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('sastranet-theme');
                  if (t === 'dark') document.documentElement.classList.add('dark');
                  else if (t === 'light') document.documentElement.classList.add('light');
                } catch (_) {}
              })();
            `,
          }}
        />
      </head>
      <body className="h-full font-sans antialiased text-[var(--color-text-primary)] bg-[var(--color-canvas-bg)] transition-colors duration-200">
        {children}
      </body>
    </html>
  );
}
