"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

const ITEMS = [
  { href: "/how-to-play", label: "How to play" },
  { href: "/stats", label: "Stats" },
  { href: "/account", label: "Account" },
  { href: "/about", label: "About" },
] as const;

export function Menu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      className="menu"
      ref={rootRef}
      onBlur={(e) => {
        if (open && !rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={btnRef}
        type="button"
        className="menu-btn"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
          <path d="M1 1h14M1 6h14M1 11h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <ul className="menu-list" id={listId}>
          {ITEMS.map((it) => (
            <li key={it.href}>
              <Link href={it.href} onClick={() => setOpen(false)}>
                {it.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
