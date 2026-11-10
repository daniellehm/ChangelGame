/** Contact form API and the admin Messages inbox. */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as contactPOST } from "@/app/api/contact/route";
import { GET as messagesGET, POST as messagesPOST } from "@/app/api/admin/messages/route";
import { adminClient } from "@/lib/supabase/admin";
import { cleanup, newAccount, newPlayer, req } from "./fixtures";

const marker = `itest-contact-${randomUUID()}`;
let admin: Awaited<ReturnType<typeof newAccount>>;
let player: Awaited<ReturnType<typeof newPlayer>>;
const saved = process.env.ADMIN_EMAILS;

const send = (body: unknown, cookie?: string) => contactPOST(req("/api/contact", { method: "POST", body, ...(cookie ? { cookie } : {}) }));

beforeAll(async () => {
  [admin, player] = await Promise.all([newAccount(), newPlayer()]);
  process.env.ADMIN_EMAILS = admin.email;
}, 60_000);

afterAll(async () => {
  process.env.ADMIN_EMAILS = saved;
  await adminClient().from("contact_messages").delete().like("message", `%${marker}%`);
  await cleanup();
}, 60_000);

describe("contact form", () => {
  it("stores a message (email optional; player id attached when playing on that browser)", async () => {
    expect((await send({ topic: "question", message: `No email here ${marker}` })).status).toBe(201);
    expect((await send({ topic: "data", message: `Send me my data ${marker}`, reply_email: "Someone@Example.com" }, player.cookie)).status).toBe(201);
    const { data } = await adminClient().from("contact_messages").select("topic, reply_email, player_id").like("message", `%${marker}%`).order("id");
    expect(data).toEqual([
      { topic: "question", reply_email: null, player_id: null },
      { topic: "data", reply_email: "someone@example.com", player_id: player.id },
    ]);
  });

  it("rejects bad input, and quietly drops honeypot submissions", async () => {
    for (const body of [{ topic: "spam", message: "hello there" }, { topic: "bug", message: "hi" }, { topic: "bug", message: "a real message", reply_email: "not-an-email" }]) {
      expect((await send(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await send({ topic: "other", message: `Buy now ${marker} bot`, website: "http://spam.example" })).status).toBe(201);
    const { count } = await adminClient().from("contact_messages").select("id", { count: "exact", head: true }).like("message", `%${marker} bot%`);
    expect(count).toBe(0);
  });

  it("the inbox is admin-only; an admin sees messages and marks them done", async () => {
    expect((await messagesGET(req("/api/admin/messages"))).status).toBe(401);
    expect((await messagesGET(req("/api/admin/messages", { cookie: player.cookie }))).status).toBe(401);
    const res = await messagesGET(req("/api/admin/messages?status=new", { cookie: admin.cookie }));
    expect(res.status).toBe(200);
    const mine = ((await res.json()).items as Array<{ id: number; message: string }>).filter((m) => m.message.includes(marker));
    expect(mine).toHaveLength(2);
    expect((await messagesPOST(req("/api/admin/messages", { method: "POST", body: { id: mine[0]!.id, status: "done" }, cookie: admin.cookie }))).status).toBe(200);
    const after = await (await messagesGET(req("/api/admin/messages?status=done", { cookie: admin.cookie }))).json();
    expect((after.items as Array<{ id: number }>).some((m) => m.id === mine[0]!.id)).toBe(true);
  });
});
