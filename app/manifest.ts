import type { MetadataRoute } from "next";

/** Web app manifest: "Add to Home Screen" with Changel's name, icon and paper colours. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Changel",
    short_name: "Changel",
    description: "Guess how much the world changed: five real numbers a day.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f1e7",
    theme_color: "#f6f1e7",
    categories: ["games", "education", "entertainment"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
