import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureSession } from "@/lib/game/session-client";

describe("ensureSession", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("concurrent calls share ONE /api/session request (no duplicate anonymous users)", async () => {
    let resolve!: (r: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((r) => (resolve = r)));
    vi.stubGlobal("fetch", fetchMock);

    const a = ensureSession("Australia/Sydney");
    const b = ensureSession("Australia/Sydney");
    const c = ensureSession("Australia/Sydney");
    resolve(Response.json({ user_id: "u", created: true }));
    expect(await Promise.all([a, b, c])).toEqual([true, true, true]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a later call makes a fresh request (the cookie decides reuse server-side)", async () => {
    const fetchMock = vi.fn(async () => Response.json({ user_id: "u", created: false }));
    vi.stubGlobal("fetch", fetchMock);
    await ensureSession("UTC");
    await ensureSession("UTC");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports failure without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    expect(await ensureSession("UTC")).toBe(false);
  });
});
