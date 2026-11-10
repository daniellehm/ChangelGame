/** Contact form → admin inbox (Dani 2026-11-10: no public email address). */
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { adminClient } from "@/lib/supabase/admin";
import { setClock, syd } from "./helpers";

process.loadEnvFile?.(".env.local");
const marker = `e2e-contact-${randomUUID()}`;

test.afterAll(async () => {
  await adminClient().from("contact_messages").delete().like("message", `%${marker}%`);
});

test("a player sends a message without an email; it's stored for the admin inbox", async ({ page }) => {
  await setClock(page, syd("2026-11-10T09:00:00"));
  await page.goto("/contact");
  await expect(page.locator("h1")).toHaveText("Get in touch");
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations.map((v) => v.id)).toEqual([]);
  await page.getByLabel("What's it about?").selectOption("bug");
  await page.getByLabel("Message").fill(`The slider jumped. ${marker}`);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator("#contactSent")).toContainText("we won't reply");
  const { data } = await adminClient().from("contact_messages").select("topic, reply_email, status").like("message", `%${marker}%`);
  expect(data).toEqual([{ topic: "bug", reply_email: null, status: "new" }]);
});
