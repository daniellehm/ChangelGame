import Link from "next/link";
import type { ReactNode } from "react";
import { launchDate } from "@/lib/config";
import { Header } from "./Header";

/** Layout for non-game pages: same header and width as the game. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="wrap">
      <Header launch={launchDate()} />
      <section className="card page">{children}</section>
      <Link href="/" className="btn back">Back to today&apos;s Changel</Link>
    </div>
  );
}
