import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { StatsView } from "@/components/StatsView";
import { launchDate } from "@/lib/config";

export const metadata: Metadata = { title: "Your stats · Changel" };

export default function Stats() {
  return (
    <PageShell>
      <div className="cat">Stats</div>
      <h1>Your Changel</h1>
      <StatsView launch={launchDate()} />
    </PageShell>
  );
}
