/** Shared by the code route and the email-link route: after a successful verify, run any pending merge. */
import { AUTH_FLOW_COOKIE, clearCookie, MERGE_COOKIE, readCookie } from "./cookies";
import { consumeMergeToken, mergeInto, type MergeResult } from "./merge";

/** Merge this browser's anonymous history into `userId` if it holds a valid merge token. */
export async function mergePending(req: Request, userId: string): Promise<MergeResult | null> {
  const token = readCookie(req, MERGE_COOKIE);
  if (!token) return null;
  const anonId = await consumeMergeToken(token);
  if (!anonId || anonId === userId) return null;
  return mergeInto(anonId, userId);
}

/** The flow and merge cookies are spent once sign-in completes. */
export function clearFlowCookies(res: Response): void {
  clearCookie(res, AUTH_FLOW_COOKIE);
  clearCookie(res, MERGE_COOKIE);
}
