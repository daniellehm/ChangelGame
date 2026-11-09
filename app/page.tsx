import { Game } from "@/components/Game";
import { launchDate } from "@/lib/config";

/**
 * Runs before first paint: if this device has played before (or has a game in
 * progress), hide the server-rendered intro so returning players don't see it
 * flash before the game resumes. Storage errors leave the intro visible.
 */
const RETURNING_SCRIPT = `try{var s=localStorage.getItem("changel:v1:stats");var p=s&&JSON.parse(s);if((p&&p.plays&&p.plays.length)||localStorage.getItem("changel:v1:active"))document.documentElement.dataset.returning="1"}catch(e){}`;

export default function Home() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: RETURNING_SCRIPT }} />
      <Game launch={launchDate()} />
    </>
  );
}
