import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "./_components/ConvexClientProvider";
import { getToken } from "@/lib/account/auth-server";
import { themeScript } from "@/lib/theme";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lead the Way",
  description:
    "A manager-first team AI learning experience. Concept prototype. Not an official IBM product.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Handing the token to the provider avoids an unauthenticated first paint.
  const initialToken = await getToken();

  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        {/* Sync and inline so a stored theme never flashes the other one. It
            must sit in an explicit <head>; React does not hoist it. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full bg-background" suppressHydrationWarning>
        <ConvexClientProvider initialToken={initialToken}>
          {children}
        </ConvexClientProvider>
      </body>
    </html>
  );
}
