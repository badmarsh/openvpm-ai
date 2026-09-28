import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, DM_Sans } from "next/font/google";
import { Providers } from "@/lib/providers";
import { SkipToContent } from "@/components/layout/skip-to-content";
import { PreviewCookieBridge } from "@/components/preview/preview-cookie-bridge";
import {
  PREVIEW_FETCH_SHIM,
  isPreviewCookieBridgeEnabled,
} from "@/lib/preview-cookie-bridge";
import "@/styles/globals.css";

const inter = Inter({
  // latin-ext covers Slovak diacritics (ľ š č ť ž ď ň á í …) — without it
  // every accented character falls back to a system font (FOUT + CLS), and
  // the default locale of this app is Slovak.
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
});

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-sans",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "MVDr. Martin Sýkora: Súkromná veterinárna ambulancia",
  description:
    "The first modern, open-source, API-first practice management system built for the veterinary community. Beautiful, fast, and free.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const previewCookieBridge = isPreviewCookieBridgeEnabled();
  return (
    <html lang="sk" suppressHydrationWarning>
      <head>
        {previewCookieBridge ? (
          // Sandbox previews only: re-send cookies the preview proxy strips.
          <script dangerouslySetInnerHTML={{ __html: PREVIEW_FETCH_SHIM }} />
        ) : null}
      </head>
      <body
        className={`${inter.variable} ${dmSans.variable} font-sans antialiased`}
      >
        <Providers>
          <SkipToContent />
          {previewCookieBridge ? (
            <Suspense fallback={null}>
              <PreviewCookieBridge />
            </Suspense>
          ) : null}
          {children}
        </Providers>
      </body>
    </html>
  );
}
