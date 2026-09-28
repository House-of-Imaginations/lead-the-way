import type { MetadataRoute } from "next";

/**
 * What the platforms read when someone installs Lead the Way.
 *
 * The colours are the literal values `--ground` resolves to in
 * `src/app/globals.css`. A manifest is fetched without a document, so there is
 * no stylesheet for a `var()` to resolve against -- these have to be literals,
 * and if the Harbor ground ever moves, it moves here too.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lead the Way",
    short_name: "Lead the Way",
    description:
      "A manager-first team AI learning experience. Concept prototype. Not an official IBM product.",

    /**
     * The app's identity, and the reason it is not simply omitted.
     *
     * With no `id`, the platform derives one from `start_url` -- so the day the
     * start URL moves, every phone with Lead the Way already on it decides the new
     * manifest describes a DIFFERENT app: the installed one stops updating and
     * a second icon can be installed beside it. Pinning it to "/" means the
     * start URL is free to change later. This value must never change.
     */
    id: "/",

    /**
     * Where a launch from the home screen lands. Point it at the app itself
     * rather than at a marketing page: somebody who installed this has already
     * been sold, and launching them into the pitch is a tax on the people who
     * liked it most.
     */
    start_url: "/?source=pwa",

    /**
     * The whole origin, so every in-app link stays inside the installed window.
     * Anything narrower ejects the user into the browser mid-task.
     */
    scope: "/",

    display: "standalone",
    orientation: "portrait",
    background_color: "#F4F6F5",
    theme_color: "#F4F6F5",

    /** Use the original brandkit symbol, without launcher cropping. */
    icons: [
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],

    /**
     * A second launch focuses the window that is already open rather than
     * opening another one. Two windows on the same realtime document is two
     * views racing each other, and the user cannot tell which they are in.
     */
    launch_handler: { client_mode: "navigate-existing" },
  };
}
