/**
 * Contact form (Dani 2026-11-10: no public email address). Players send a message, optionally
 * with an email for a reply; it lands in the admin portal's Messages inbox. Server only.
 */
import { z } from "zod";
import { adminClient } from "./supabase/admin";

export const CONTACT_TOPICS = {
  question: "A question or idea",
  data: "A copy of my data, or a correction",
  delete: "Delete my data",
  bug: "Something's broken",
  other: "Something else",
} as const;
export type ContactTopic = keyof typeof CONTACT_TOPICS;

export const ContactBody = z.object({
  topic: z.enum(Object.keys(CONTACT_TOPICS) as [ContactTopic, ...ContactTopic[]]),
  message: z.string().trim().min(5, "write a little more").max(2000, "keep it under 2,000 characters"),
  reply_email: z.union([z.literal(""), z.string().trim().toLowerCase().email("that doesn't look like an email address").max(254)]).optional(),
  /** Honeypot: hidden from people, filled in by naive bots. */
  website: z.string().max(200).optional(),
});

export interface ContactMessage {
  id: number;
  topic: ContactTopic;
  message: string;
  reply_email: string | null;
  player_id: string | null;
  status: "new" | "done";
  created_at: string;
  handled_at: string | null;
}

export async function saveContact(b: z.infer<typeof ContactBody>, playerId: string | null): Promise<void> {
  const { error } = await adminClient()
    .from("contact_messages")
    .insert({ topic: b.topic, message: b.message, reply_email: b.reply_email || null, player_id: playerId });
  if (error) throw error;
}

export async function listContact(status: "new" | "done" | "all"): Promise<ContactMessage[]> {
  let q = adminClient().from("contact_messages").select("*").order("created_at", { ascending: false }).limit(200);
  if (status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ContactMessage[];
}

export async function contactCount(): Promise<number> {
  const { count, error } = await adminClient().from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new");
  if (error) throw error;
  return count ?? 0;
}

export async function setContactStatus(id: number, status: "new" | "done"): Promise<boolean> {
  const { data, error } = await adminClient()
    .from("contact_messages")
    .update({ status, handled_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}
