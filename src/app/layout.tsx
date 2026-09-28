import type { Metadata } from "next";
import localFont from "next/font/local";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "./_components/ConvexClientProvider";
import { ServiceWorker } from "./_components/ServiceWorker";
import { getToken } from "@/lib/account/auth-server";
import { themeScript } from "@/lib/theme";

// Two faces, one job each. General Sans sets everything a person wrote or a
// designer labelled; IBM Plex Mono sets identifiers, measurements and text
// quoted verbatim out of an evidence document. See DESIGN.md's Evidence Voice
// rule before reaching for the mono anywhere else.
//
// General Sans is not on Google Fonts, so the variable file (200-700) is
// vendored under `src/app/fonts` and served from this origin. Self-hosting is
// also what keeps the first paint free of a third-party round trip on a
// dealership connection.
const generalSans = localFont({
  variable: "--font-general-sans",
  display: "swap",
  src: [
    {
      path: "./fonts/GeneralSans-Variable.woff2",
      weight: "200 700",
      style: "normal",
    },
    {
      path: "./fonts/GeneralSans-VariableItalic.woff2",
      weight: "200 700",
      style: "italic",
    },
  ],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lead the Way",
  icons: {
    icon: { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    apple: { url: "/icon-192.png", sizes: "192x192" },
  },
  description:
    "A manager-first team AI learning experience. Concept prototype. Not an official IBM product.",
  // What iOS reads when Lead the Way is added to the home screen. The manifest's
  // `display: standalone` is honoured by Safari 16.4+, but these tags are what
  // older iOS goes by and they cost nothing to keep. `default` status bar
  // rather than `black-translucent`: translucent hands the app the strip under
  // the clock without telling it how tall that strip is, and every screen here
  // is a plain document with no safe-area padding -- the first line of every
  // page would sit under the time.
  appleWebApp: {
    capable: true,
    title: "Lead the Way",
    statusBarStyle: "default",
  },
};

// No `export const viewport`. In particular no `themeColor`: Next emits that as
// `prefers-color-scheme` media queries, which follow the OS and cannot see the
// `data-theme` this app's own toggle sets. The meta is written instead by the
// pre-paint script and kept in step by `ThemeToggle` -- see `src/lib/theme.ts`.

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
      className={`${generalSans.variable} ${plexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Runs before first paint so a light-mode visitor never sees a dark
            flash, which is why it is inline and synchronous rather than
            deferred. It must sit inside an explicit <head>: React does NOT
            hoist a bare sync <script> out of <html> -- it refuses to order it
            and logs "cannot render a sync or defer <script> outside the main
            document", then reports <script> as an invalid child of <html> and
            fails hydration. An earlier comment here claimed the hoist happens;
            it does not. The Next 16 guide writes the explicit <head> for the
            same reason:
            node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      {/* Grammarly and friends stamp their own attributes (data-gr-ext-installed,
          data-new-gr-c-s-check-loaded) onto <body> before React hydrates, and
          suppressHydrationWarning does not cascade from <html> -- it covers one
          element only. Without this, every visitor with the extension sees a
          hydration mismatch the app cannot fix. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ConvexClientProvider initialToken={initialToken}>
          {children}
        </ConvexClientProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
