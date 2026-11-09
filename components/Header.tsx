"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { headerDate, localDate, puzzleNumber } from "@/lib/dates";
import { Menu } from "./Menu";

interface Props {
  /** Server-provided launch date, used when no explicit puzzle is given. */
  launch: string;
  /** The puzzle being played (may be yesterday's while finishing across midnight). */
  puzzle?: { number: number; date: string } | null;
}

export function Header({ launch, puzzle }: Props) {
  const [today, setToday] = useState<{ number: number; date: string } | null>(null);

  useEffect(() => {
    if (puzzle) return;
    const date = localDate(new Date());
    // Deferred so first client render matches the server (no date on the server).
    const id = requestAnimationFrame(() => setToday({ date, number: puzzleNumber(date, launch) }));
    return () => cancelAnimationFrame(id);
  }, [launch, puzzle]);

  const meta = puzzle ?? today;

  return (
    <header>
      <Link href="/" className="logo" aria-label="Changel home">
        <span className="mark" aria-hidden="true">⇅</span>Changel
      </Link>
      <div className="head-right">
        <div className="meta" id="meta">
          {meta && (
            <>
              <span className="sr-only">Puzzle </span>#{meta.number}
              <br />
              {headerDate(meta.date)}
            </>
          )}
        </div>
        <Menu />
      </div>
    </header>
  );
}
