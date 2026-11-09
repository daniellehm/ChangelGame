/**
 * Delete the anonymous users E2E runs create. /api/session tags them with
 * user_metadata.e2e = true, but only when the test clock is on, which is
 * never the case in production, so real players are never matched.
 */
import { adminClient } from "@/lib/supabase/admin";

export default async function globalTeardown() {
  process.loadEnvFile?.(".env.local");
  const db = adminClient();
  let page = 1;
  let deleted = 0;
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const tagged = data.users.filter((u) => u.is_anonymous && u.user_metadata?.e2e === true);
    for (const u of tagged) {
      const { error: e } = await db.auth.admin.deleteUser(u.id);
      if (!e) deleted++;
    }
    if (data.users.length < 1000) break;
    page++;
  }
  if (deleted) console.log(`[e2e teardown] deleted ${deleted} test players`);
}
