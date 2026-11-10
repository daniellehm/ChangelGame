import { after } from "next/server";

/**
 * Run `task` after the response is sent (Next's `after`). Outside a request scope
 * (route handlers called directly in tests) it just starts the task. Never throws.
 */
export function runAfter(task: () => Promise<unknown>): void {
  const safe = () => task().catch((e) => console.error("after-task failed", e));
  try {
    after(safe);
  } catch {
    void safe();
  }
}
