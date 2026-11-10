"use client";

import { useEffect, useRef } from "react";
import { MAX_TOTAL } from "@/lib/config";
import type { SharedResult } from "@/lib/game/share";
import { TIERS } from "@/lib/scoring";

/**
 * Shown once when someone opens a friend's shared link (?r=): their score and squares,
 * and a challenge. Closes with ×, Escape, a tap outside, or Play (Dani 2026-11-10).
 */
export function FriendPopup({ friend, today, onClose, onPlay }: { friend: SharedResult; today: number | null; onClose: () => void; onPlay: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const sameDay = today === null || friend.number === today;

  useEffect(() => {
    // Focus the dialog itself: announced to screen readers, no focus ring until someone tabs.
    boxRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="day-pop-backdrop" onClick={onClose}>
      <div ref={boxRef} tabIndex={-1} className="day-pop friend-pop" role="dialog" aria-modal="true" aria-labelledby="friendTitle" onClick={(e) => e.stopPropagation()}>
        <div className="day-pop-head">
          <div>
            <small>A friend played Changel #{friend.number}</small>
            <h2 id="friendTitle">
              {friend.total}
              <span>/{MAX_TOTAL}</span>
            </h2>
          </div>
          <button type="button" className="day-pop-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="friend-grid" role="img" aria-label={friend.tiers.map((t) => TIERS[t].label).join(", ")}>
          {friend.tiers.map((t, i) => (
            <span key={i}>{TIERS[t].emoji}</span>
          ))}
        </p>
        <p className="friend-ask" id="friendLine">
          {sameDay ? "Can you beat it?" : "That was an earlier puzzle. Today's is waiting."}
        </p>
        <button type="button" className="btn" onClick={onPlay}>
          {sameDay ? "Play" : "Play today's"}
        </button>
      </div>
    </div>
  );
}
