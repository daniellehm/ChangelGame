/**
 * GET /api/og?r=<code> → 1200×630 PNG of a shared result: score, grid, logo on the
 * paper background (SPEC §10). Without a valid code: the game's default card.
 * Deterministic per code, so it's cached hard at the edge.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { MAX_TOTAL } from "@/lib/config";
import { decodeShareCode } from "@/lib/game/share";
import { rateLimit } from "@/lib/api/ratelimit";
import { clientIp } from "@/lib/supabase/request";
import type { TierId } from "@/lib/scoring";

/** Token colours (app/globals.css); Satori can't read CSS variables. */
const C = { bg: "#f6f1e7", ink: "#16130f", muted: "#7a7166", card: "#fffdf8", line: "#e3dacb", up: "#ff5a36" };
/** Same colours as the share text's emoji squares (🟩🟨🟧🟥). */
const SQUARE: Record<TierId, string> = { nailed: "#2bb673", close: "#f3c13a", meh: "#ff8a3d", off: "#e5484d", wrong: "#e5484d" };

const fonts = (async () => {
  const dir = join(process.cwd(), "assets/fonts");
  const [sans, mono] = await Promise.all([readFile(join(dir, "BricolageGrotesque-800.ttf")), readFile(join(dir, "JetBrainsMono-700.ttf"))]);
  return [
    { name: "Bricolage", data: sans, weight: 800 as const, style: "normal" as const },
    { name: "Mono", data: mono, weight: 700 as const, style: "normal" as const },
  ];
})();

const LOGO = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#16130f"/><g fill="none" stroke="#f6f1e7" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 47V18M13.5 27.5 23 17.5l9.5 10"/><path d="M41 17v29M31.5 36.5 41 46.5l9.5-10"/></g></svg>',
).toString("base64")}`;

function Squares({ tiers }: { tiers: TierId[] }) {
  return (
    <div style={{ display: "flex", gap: 18 }}>
      {tiers.map((t, i) => (
        <div key={i} style={{ width: 92, height: 92, borderRadius: 18, background: SQUARE[t], border: `5px solid ${C.ink}` }} />
      ))}
    </div>
  );
}

export async function GET(req: Request) {
  // Only cache misses get here, but each new code costs a render: cap per IP.
  const limited = await rateLimit("og", clientIp(req) ?? "unknown");
  if (limited) return limited;
  const shared = decodeShareCode(new URL(req.url).searchParams.get("r"));
  const image = (
    <div style={{ width: 1200, height: 630, display: "flex", background: C.bg, padding: 48, fontFamily: "Bricolage", color: C.ink }}>
      <div style={{ position: "relative", display: "flex", flex: 1 }}>
        {/* Hard offset shadow, as on the game's card. */}
        <div style={{ display: "flex", position: "absolute", left: 16, top: 16, right: -16, bottom: -16, background: C.ink, borderRadius: 44 }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", flex: 1, background: C.card, border: `6px solid ${C.ink}`, borderRadius: 44, padding: "44px 56px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain img */}
              <img src={LOGO} width={76} height={76} alt="" />
              <div style={{ display: "flex", fontSize: 60, letterSpacing: -2 }}>Changel</div>
            </div>
            <div style={{ display: "flex", fontFamily: "Mono", fontSize: 36, color: C.muted }}>{shared ? `#${shared.number}` : "changel.app"}</div>
          </div>
          {shared ? (
            <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontFamily: "Mono", fontSize: 28, color: C.muted, letterSpacing: 2 }}>SCORE</div>
                <div style={{ display: "flex", alignItems: "baseline" }}>
                  <div style={{ display: "flex", fontSize: 190, lineHeight: 1, letterSpacing: -8 }}>{shared.total}</div>
                  <div style={{ display: "flex", fontFamily: "Mono", fontSize: 44, color: C.muted, marginLeft: 12 }}>{`/${MAX_TOTAL}`}</div>
                </div>
              </div>
              <Squares tiers={shared.tiers} />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", gap: 28 }}>
              <div style={{ display: "flex", fontSize: 96, lineHeight: 1, letterSpacing: -4 }}>How much did it change?</div>
              <Squares tiers={["nailed", "close", "nailed", "meh", "nailed"]} />
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Mono", fontSize: 28, color: C.muted }}>
            <div>{shared ? "Can you beat it?" : "The daily game about how much the world changed"}</div>
            <div style={{ display: "flex", color: C.up }}>{shared ? "changel.app" : ""}</div>
          </div>
        </div>
      </div>
    </div>
  );
  return new ImageResponse(image, {
    width: 1200,
    height: 630,
    fonts: await fonts,
    headers: { "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable" },
  });
}
