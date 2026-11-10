/** M6 task 6.2: share images. Renders real PNGs (Satori), so it checks size and caching, not pixels. */
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/og/route";

/** Width and height from a PNG's IHDR chunk. */
const pngSize = (b: Buffer) => ({ width: b.readUInt32BE(16), height: b.readUInt32BE(20) });

describe("GET /api/og", () => {
  it("renders a shared result as a 1200×630 PNG, cached hard (same code, same image)", async () => {
    const res = await GET(new Request("https://changel.app/api/og?r=c-ac-01040"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(pngSize(Buffer.from(await res.arrayBuffer()))).toEqual({ width: 1200, height: 630 });
  });

  it("falls back to the default card for a missing or bad code", async () => {
    for (const url of ["https://changel.app/api/og", "https://changel.app/api/og?r=nonsense"]) {
      const res = await GET(new Request(url));
      expect(res.status).toBe(200);
      expect(pngSize(Buffer.from(await res.arrayBuffer()))).toEqual({ width: 1200, height: 630 });
    }
  });
});
