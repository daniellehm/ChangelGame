import type { MetadataRoute } from "next";

/** SPEC §10 SEO: the public pages. The home page changes every day. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://changel.app";
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/how-to-play`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
