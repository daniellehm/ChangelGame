import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = { title: "About · Changel" };

export default function About() {
  return (
    <PageShell>
      <div className="cat">About</div>
      <h1>About Changel</h1>
      <p>Changel is a free daily game about how much the world has changed. Five real numbers from the past, one guess each: how many times bigger or smaller are they now?</p>
      <p>Every number comes with its source. If something looks wrong, you&apos;ll soon be able to report it from the reveal screen.</p>
      <p>No account is needed, and anonymous play stores no personal information.</p>
    </PageShell>
  );
}
