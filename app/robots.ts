import type { MetadataRoute } from "next";

/** SPEC §10 SEO. Personal and admin pages stay out of search; so do the API routes. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/account", "/stats", "/auth"] },
    sitemap: "https://changel.app/sitemap.xml",
    host: "https://changel.app",
  };
}
