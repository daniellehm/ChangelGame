import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = { title: "Account · Changel" };

export default function Account() {
  return (
    <PageShell>
      <div className="cat">Account</div>
      <h1>Save your streak</h1>
      <p>You don&apos;t need an account to play. Your games are saved on this device.</p>
      <p>Soon you&apos;ll be able to sign in with an email link or Google, so your history and streak follow you to any device.</p>
    </PageShell>
  );
}
