import type { Metadata } from "next";
import { headers } from "next/headers";
import { runAfter } from "@/lib/api/after";
import { recordVisit } from "@/lib/analytics/server";
import { Game } from "@/components/Game";
import { launchDate } from "@/lib/config";
import { decodeShareCode, encodeShareCode } from "@/lib/game/share";

/**
 * Runs before first paint: if this device has played before (or has a game in
 * progress), hide the server-rendered intro so returning players don't see it
 * flash before the game resumes. Storage errors leave the intro visible.
 * Not used on a shared link (?r=): that always shows the intro with the friend's score.
 */
const RETURNING_SCRIPT = `try{var s=localStorage.getItem("changel:v1:stats");var p=s&&JSON.parse(s);if((p&&p.plays&&p.plays.length)||localStorage.getItem("changel:v1:active"))document.documentElement.dataset.returning="1"}catch(e){}`;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const sharedFrom = async (searchParams: Props["searchParams"]) => {
  const r = (await searchParams).r;
  return decodeShareCode(typeof r === "string" ? r : null);
};

/** A shared link (?r=) unfurls as that result: its score and grid as the image (SPEC §10). */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const shared = await sharedFrom(searchParams);
  if (!shared) return {};
  const title = `Changel #${shared.number} ⇅ ${shared.total}/500`;
  const description = "Can you beat it? The daily game about how much the world changed.";
  const image = { url: `/api/og?r=${encodeShareCode(shared)}`, width: 1200, height: 630, alt: `${title}. ${description}` };
  return {
    title,
    description,
    openGraph: { title, description, images: [image], url: `/?r=${encodeShareCode(shared)}` },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

/**
 * Structured data (schema.org) so search engines know what this is: a free daily web game.
 * WebSite gives the result its site name; VideoGame + WebApplication describe the game.
 */
const STRUCTURED_DATA = JSON.stringify([
  { "@context": "https://schema.org", "@type": "WebSite", name: "Changel", url: "https://changel.app/" },
  {
    "@context": "https://schema.org",
    "@type": ["VideoGame", "WebApplication"],
    name: "Changel",
    url: "https://changel.app/",
    description: "Guess how much the world changed: five real numbers a day. Each round shows a real figure from the past; slide to guess how many times bigger or smaller it got.",
    image: "https://changel.app/api/og",
    genre: ["Trivia", "Puzzle"],
    gamePlatform: "Web browser",
    applicationCategory: "GameApplication",
    operatingSystem: "Any",
    playMode: "SinglePlayer",
    inLanguage: "en",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  },
]);

export default async function Home({ searchParams }: Props) {
  const shared = await sharedFrom(searchParams);
  // Count the visit (SPEC §8) after the response is sent, so it never slows the page.
  const h = new Headers(await headers());
  runAfter(() => recordVisit(h, !!shared));
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: STRUCTURED_DATA }} />
      {!shared && <script dangerouslySetInnerHTML={{ __html: RETURNING_SCRIPT }} />}
      <Game launch={launchDate()} friend={shared} />
    </>
  );
}
