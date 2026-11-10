import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/ContactForm";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Contact",
  description: "Send a question, a data request or a bug report.",
  alternates: { canonical: "/contact" },
};

export default function Contact() {
  return (
    <PageShell>
      <div className="cat">Contact</div>
      <h1>Get in touch</h1>
      <p>
        Questions, ideas, data requests or bugs. For a wrong number in a puzzle, the &ldquo;Something wrong with this?&rdquo; link on that answer is
        quickest. See also <Link href="/privacy" className="text-link">privacy &amp; terms</Link>.
      </p>
      <ContactForm />
    </PageShell>
  );
}
