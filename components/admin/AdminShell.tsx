"use client";

/**
 * Admin layout + data gate (M5 task 5.7). Every admin page loads its data from
 * /api/admin/*, which checks ADMIN_EMAILS on the server; this component shows
 * sign-in / no-access states and the section nav. Works on mobile.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

export const ADMIN_NAV = [
  { href: "/admin", label: "Home" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/upcoming", label: "Upcoming" },
  { href: "/admin/flagged", label: "Flagged" },
  { href: "/admin/bank", label: "Bank" },
  { href: "/admin/health", label: "Health" },
  { href: "/admin/analytics", label: "Analytics" },
] as const;

export type Load<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "signin" } | { state: "denied" } | { state: "error"; message: string };

/** GET an admin endpoint; `reload` refetches (after an action). */
export function useAdmin<T>(path: string): [Load<T>, () => void] {
  const [load, setLoad] = useState<Load<T>>({ state: "loading" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    fetch(path, { cache: "no-store" })
      .then(async (res) => {
        if (!live) return;
        if (res.status === 401) return setLoad({ state: "signin" });
        if (res.status === 403) return setLoad({ state: "denied" });
        const body = await res.json().catch(() => null);
        if (!res.ok) return setLoad({ state: "error", message: body?.error?.message ?? `Error ${res.status}` });
        setLoad({ state: "ok", data: body as T });
      })
      .catch(() => live && setLoad({ state: "error", message: "Network error. Try again." }));
    return () => {
      live = false;
    };
  }, [path, tick]);
  return [load, useCallback(() => setTick((t) => t + 1), [])];
}

/** POST/PATCH/DELETE an admin endpoint; resolves to the JSON body or throws the server's message. */
export async function adminSend<T = unknown>(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(path, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? `Error ${res.status}`);
  return json as T;
}

export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const path = usePathname();
  return (
    <div className="wrap admin">
      <header className="admin-head">
        <Link href="/" className="logo" aria-label="Changel home">
          <span className="mark" aria-hidden="true">⇅</span>Changel
        </Link>
        <span className="cat">Admin</span>
      </header>
      <nav className="admin-nav" aria-label="Admin sections">
        {ADMIN_NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={path === n.href ? "page" : undefined}>
            {n.label}
          </Link>
        ))}
      </nav>
      <section className="card page">
        <h1>{title}</h1>
        {children}
      </section>
    </div>
  );
}

/** Renders the loaded data, or the right message for signed-out / no-access / errors. */
export function Gate<T>({ load, children }: { load: Load<T>; children: (data: T) => ReactNode }) {
  switch (load.state) {
    case "loading":
      return <p className="muted" aria-busy="true">Loading…</p>;
    case "signin":
      return (
        <p>
          Sign in with your admin email on the <Link href="/account">account page</Link>, then come back.
        </p>
      );
    case "denied":
      return <p>This account doesn&apos;t have admin access.</p>;
    case "error":
      return <p role="alert">{load.message}</p>;
    case "ok":
      return <>{children(load.data)}</>;
  }
}
