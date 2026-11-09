/** Where email links send people back to: this deployment's /auth/confirm. */
export function confirmUrl(req: Request): string {
  const u = new URL(req.url);
  return `${u.origin}/auth/confirm`;
}
