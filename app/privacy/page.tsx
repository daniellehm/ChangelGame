import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Changel stores, why, for how long, and your choices. No ads, no tracking cookies.",
  alternates: { canonical: "/privacy" },
};

/** Written for the Australian Privacy Principles and GDPR basics (SPEC §11). Keep in step with the code. */
export default function Privacy() {
  return (
    <PageShell>
      <div className="cat">Privacy</div>
      <h1>Your privacy</h1>
      <p className="muted">Last updated 10 November 2026</p>

      <p>
        Changel is a free daily game. We collect as little as we can to run it: no ads, no tracking cookies, and nothing sold or shared for marketing.
        This policy covers changel.app and is written for the Australian Privacy Principles and the EU/UK GDPR.
      </p>

      <h2>What we store</h2>
      <ul className="prose-list">
        <li>
          <b>When you play without an account:</b> a random player ID, your time zone, and your games (each guess, its score and when you played).
          Nothing that identifies you by name.
        </li>
        <li>
          <b>If you add your email:</b> your email address, so you can sign in on other devices and keep your streak. We only email you sign-in codes,
          never newsletters.
        </li>
        <li>
          <b>If you report a question:</b> the reason you picked and any note you write.
        </li>
        <li>
          <b>Visit counts:</b> when the game page loads we count one visit per visitor per day, with your country (from your IP address), device type
          (phone, tablet or computer) and the website that linked you here. We don&apos;t store your IP address for this. To count each visitor once a day we use
          a scrambled code made from your IP address, browser and the date, which changes every day, so it can&apos;t follow you from one day to the next. If
          your browser sends &ldquo;Do Not Track&rdquo; or &ldquo;Global Privacy Control&rdquo;, we don&apos;t record where you came from.
        </li>
        <li>
          <b>A few in-game actions:</b> that you pressed Share (and how), and that the &ldquo;save your streak&rdquo; offer was shown.
        </li>
        <li>
          <b>On this device:</b> your recent games and stats are also kept in your browser&apos;s local storage, so the game works offline.
        </li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We use only strictly necessary cookies: the ones that keep your game session (and your sign-in, if you have an account) and, briefly, the
        one that remembers which sign-in code to expect. There are no analytics or advertising cookies, so there&apos;s no cookie banner.
      </p>

      <h2>Why we use it</h2>
      <p>
        To run the game (scoring, streaks, stats, syncing across your devices), to keep it fair and safe (stopping bots and abuse), to fix
        mistakes in questions, and to understand, in totals only, how many people play and where they drop off. Under GDPR, our lawful basis is
        providing the service you asked for, and our legitimate interest in running and improving a free game.
      </p>

      <h2>Who helps us run it</h2>
      <p>These providers process data for us, under their own security and privacy terms. Some are outside Australia:</p>
      <ul className="prose-list">
        <li><b>Vercel</b> (hosting; servers in Singapore and worldwide edge)</li>
        <li><b>Supabase</b> (database and sign-in; Singapore)</li>
        <li><b>Resend</b> (sends sign-in code emails; United States)</li>
        <li><b>Upstash</b> (rate limits, which briefly use your IP address or player ID; Singapore)</li>
        <li><b>Cloudflare Turnstile</b> (checks a new player isn&apos;t a bot; worldwide)</li>
        <li><b>Anthropic</b> (helps research and fact-check questions; it never receives anything about players)</li>
        <li><b>Sentry</b>, if switched on (error reports to help us fix crashes; no names or emails)</li>
        <li><b>Buy Me a Coffee</b> (the optional tip button; if you use it, their terms apply)</li>
      </ul>

      <h2>How long we keep it</h2>
      <ul className="prose-list">
        <li>Players without an account who never start a game are deleted after 7 days, and players without an account who stop playing are deleted after 400 days.</li>
        <li>Accounts and their games stay until you delete them.</li>
        <li>Visit and action records are deleted after 400 days. Daily totals (no individual records) are kept.</li>
      </ul>

      <h2>Your choices and rights</h2>
      <ul className="prose-list">
        <li><b>Delete everything:</b> on the <Link href="/account" className="text-link">account page</Link>, &ldquo;Delete my account&rdquo; removes your account and every game.</li>
        <li><b>Get a copy, or correct something:</b> email us and we&apos;ll send your data or fix it, usually within 30 days.</li>
        <li><b>Play without an account:</b> you never have to give us your email.</li>
        <li>
          <b>Complaints:</b> tell us first. If you&apos;re not happy with our answer, you can contact the Office of the Australian Information Commissioner
          (oaic.gov.au) or, in the EU/UK, your local data protection authority.
        </li>
      </ul>

      <h2>Children</h2>
      <p>Changel is for a general audience. If you&apos;re under 16, please ask a parent before adding an email address.</p>

      <h2>Security</h2>
      <p>Data is encrypted in transit, access to the database is restricted to the game&apos;s servers, and secret keys never reach your browser.</p>

      <h2>Changes and contact</h2>
      <p>
        If we change this policy we&apos;ll update the date above. Questions or requests: <a className="text-link" href="mailto:hello@changel.app">hello@changel.app</a>.
      </p>
    </PageShell>
  );
}
