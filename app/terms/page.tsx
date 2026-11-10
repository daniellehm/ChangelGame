import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Terms",
  description: "The simple rules for playing Changel.",
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <PageShell>
      <div className="cat">Terms</div>
      <h1>Terms of use</h1>
      <p className="muted">Last updated 10 November 2026</p>

      <p>By playing Changel at changel.app you agree to these terms. They&apos;re short on purpose.</p>

      <h2>The game</h2>
      <p>
        Changel is free. A new puzzle comes out every day, and we may change, pause or stop the game, or any feature of it, at any time. Accounts are
        optional; if you make one, keep your email up to date so you can sign in.
      </p>

      <h2>Fair play</h2>
      <ul className="prose-list">
        <li>Don&apos;t use bots or scripts to play, flood the game with requests, or try to get answers before you lock in a guess.</li>
        <li>Don&apos;t try to break, overload or get around the game&apos;s security.</li>
        <li>Use the &ldquo;Something wrong with this?&rdquo; link honestly: it&apos;s how we fix mistakes.</li>
      </ul>
      <p>We may remove scores or accounts that break these rules.</p>

      <h2>The numbers</h2>
      <p>
        Every number comes from a published source, which is linked on each answer, and is checked before it goes live. Even so, sources can be
        wrong or revised, and we sometimes round. Changel is a game, not a reference: please don&apos;t rely on it for anything important. If we fix
        a question after it&apos;s live, your score for that day stays as it was.
      </p>

      <h2>Ownership</h2>
      <p>
        The Changel name, design, code and question writing are ours. Your share results are yours to post anywhere. Sources and their data belong to
        their publishers.
      </p>

      <h2>No warranty</h2>
      <p>
        The game is provided as is. To the extent the law allows, we aren&apos;t liable for losses from using it, including lost streaks or scores from
        outages. Nothing here limits rights you have under the Australian Consumer Law or other laws that can&apos;t be excluded.
      </p>

      <h2>Privacy</h2>
      <p>
        See the <Link href="/privacy" className="text-link">privacy policy</Link> for what we store and why.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We may update these terms; the date above shows when. These terms are governed by the laws of New South Wales, Australia. Questions:{" "}
        <a className="text-link" href="mailto:hello@changel.app">hello@changel.app</a>.
      </p>
    </PageShell>
  );
}
