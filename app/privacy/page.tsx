import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Privacy & terms",
  description: "What Changel stores, why, for how long, your choices, and the simple rules for playing. No ads, no tracking cookies.",
  alternates: { canonical: "/privacy" },
};

/**
 * Privacy (Australian Privacy Principles + GDPR basics, SPEC §11) and terms on one page.
 * No operator name or email address (Dani 2026-11-10): contact goes through /contact.
 * Keep in step with the code.
 */
export default function PrivacyAndTerms() {
  return (
    <PageShell>
      <div className="cat">Privacy &amp; terms</div>
      <h1>Privacy &amp; terms</h1>
      <p className="muted">Last updated 10 November 2026</p>
      <p className="legal-jump">
        <a href="#privacy">Privacy</a> · <a href="#terms">Terms</a>
      </p>

      <section id="privacy" aria-labelledby="privacy-h">
        <h2 id="privacy-h">Privacy</h2>
        <p>
          Changel is a free daily game. We collect as little as we can to run it: no ads, no tracking cookies, and nothing sold or shared for marketing.
          This covers changel.app and is written for the Australian Privacy Principles and the EU/UK GDPR.
        </p>

        <h3>What we store</h3>
        <ul className="prose-list">
          <li>
            <b>When you play without an account:</b> a random player ID, your time zone, and your games (each guess, its score and when you played).
            Nothing that identifies you by name.
          </li>
          <li>
            <b>If you add your email:</b> your email address, so you can sign in on other devices and keep your streak. We only email you sign-in codes,
            never newsletters.
          </li>
          <li><b>If you report a question:</b> the reason you picked and any note you write.</li>
          <li>
            <b>If you use the contact form:</b> your message, and your email only if you choose to leave it for a reply. If you&apos;re playing on that
            browser, your player ID is attached so we can find your games.
          </li>
          <li>
            <b>Visit counts:</b> when the game page loads we count one visit per visitor per day, with your country (from your IP address), device type
            (phone, tablet or computer) and the website that linked you here. We don&apos;t store your IP address for this. To count each visitor once a day we
            use a scrambled code made from your IP address, browser and the date, which changes every day, so it can&apos;t follow you from one day to the next.
            If your browser sends &ldquo;Do Not Track&rdquo; or &ldquo;Global Privacy Control&rdquo;, we don&apos;t record where you came from.
          </li>
          <li><b>A few in-game actions:</b> that you pressed Share (and how), and that the &ldquo;save your streak&rdquo; offer was shown.</li>
          <li><b>On this device:</b> your recent games and stats are also kept in your browser&apos;s local storage, so the game works offline.</li>
        </ul>

        <h3>Cookies</h3>
        <p>
          Only strictly necessary cookies: the ones that keep your game session (and your sign-in, if you have an account) and, briefly, the one that
          remembers which sign-in code to expect. No analytics or advertising cookies, so there&apos;s no cookie banner.
        </p>

        <h3>Why we use it</h3>
        <p>
          To run the game (scoring, streaks, stats, syncing across your devices), to keep it fair and safe (stopping bots and abuse), to fix mistakes in
          questions, to answer messages, and to understand, in totals only, how many people play and where they drop off. Under GDPR, our lawful basis is
          providing the service you asked for, and our legitimate interest in running and improving a free game.
        </p>

        <h3>Who helps us run it</h3>
        <p>These providers process data for us under their own security and privacy terms. Some are outside Australia:</p>
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

        <h3>How long we keep it</h3>
        <ul className="prose-list">
          <li>Players without an account who never start a game are deleted after 7 days, and players without an account who stop playing after 400 days.</li>
          <li>Accounts and their games stay until you delete them.</li>
          <li>Visit and action records are deleted after 400 days. Daily totals (no individual records) are kept.</li>
          <li>Contact messages are kept until they&apos;re dealt with, then deleted within a year.</li>
        </ul>

        <h3>Your choices and rights</h3>
        <ul className="prose-list">
          <li><b>Delete everything:</b> on the <Link href="/account" className="text-link">account page</Link>, &ldquo;Delete my account&rdquo; removes your account and every game.</li>
          <li>
            <b>Get a copy, or correct something:</b> ask through the <Link href="/contact" className="text-link">contact form</Link>, from the browser you play
            on, and leave an email so we can send it. We usually answer within 30 days.
          </li>
          <li><b>Play without an account:</b> you never have to give us your email.</li>
          <li>
            <b>Complaints:</b> tell us first through the contact form. If you&apos;re not happy with our answer, you can contact the Office of the Australian
            Information Commissioner (oaic.gov.au) or, in the EU/UK, your local data protection authority.
          </li>
        </ul>

        <h3>Children</h3>
        <p>Changel is for a general audience. If you&apos;re under 16, please ask a parent before adding an email address.</p>

        <h3>Security</h3>
        <p>Data is encrypted in transit, access to the database is restricted to the game&apos;s servers, and secret keys never reach your browser.</p>
      </section>

      <section id="terms" aria-labelledby="terms-h">
        <h2 id="terms-h">Terms</h2>
        <p>By playing Changel at changel.app you agree to these terms. They&apos;re short on purpose.</p>

        <h3>The game</h3>
        <p>
          Changel is free. A new puzzle comes out every day, and we may change, pause or stop the game, or any feature of it, at any time. Accounts are
          optional; if you make one, keep your email up to date so you can sign in.
        </p>

        <h3>Fair play</h3>
        <ul className="prose-list">
          <li>Don&apos;t use bots or scripts to play, flood the game with requests, or try to get answers before you lock in a guess.</li>
          <li>Don&apos;t try to break, overload or get around the game&apos;s security.</li>
          <li>Use the &ldquo;Something wrong with this?&rdquo; link honestly: it&apos;s how we fix mistakes.</li>
        </ul>
        <p>We may remove scores or accounts that break these rules.</p>

        <h3>The numbers</h3>
        <p>
          Every number comes from a published source, linked on each answer, and is checked before it goes live. Even so, sources can be wrong or revised,
          and we sometimes round. Changel is a game, not a reference: please don&apos;t rely on it for anything important. If we fix a question after it&apos;s
          live, your score for that day stays as it was.
        </p>

        <h3>Ownership</h3>
        <p>
          The Changel name, design, code and question writing belong to Changel. Your share results are yours to post anywhere. Sources and their data belong
          to their publishers.
        </p>

        <h3>No warranty</h3>
        <p>
          The game is provided as is. To the extent the law allows, we aren&apos;t liable for losses from using it, including lost streaks or scores from
          outages. Nothing here limits rights you have under the Australian Consumer Law or other laws that can&apos;t be excluded.
        </p>

        <h3>Changes and contact</h3>
        <p>
          We may update this page; the date at the top shows when. These terms are governed by the laws of New South Wales, Australia. Questions: use the{" "}
          <Link href="/contact" className="text-link">contact form</Link>.
        </p>
      </section>
    </PageShell>
  );
}
