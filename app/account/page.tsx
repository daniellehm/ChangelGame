import type { Metadata } from "next";
import { AccountView } from "@/components/AccountView";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

export default function Account() {
  return (
    <PageShell>
      <h1>Your account</h1>
      <AccountView />
    </PageShell>
  );
}
