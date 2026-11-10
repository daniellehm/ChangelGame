import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { sessionUser } from "@/lib/api/auth";
import { isAdmin } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/**
 * The admin portal doesn't exist for anyone but an admin (Dani 2026-11-10): no sign-in
 * prompt, just the normal 404. Admins sign in on /account first. Every /api/admin route
 * also checks ADMIN_EMAILS on its own (lib/admin/auth.ts).
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = await sessionUser(new Request("http://changel.local/admin", { headers: await headers() }));
  if (!isAdmin(user)) notFound();
  return children;
}
