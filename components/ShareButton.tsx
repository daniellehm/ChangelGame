"use client";

import { useRef, useState } from "react";

interface Props {
  /** Exact share text (SPEC §10), copied to the clipboard. */
  text: string;
  /** The text without its link line, for the share sheet (which adds `url`). */
  teaser: string;
  /** `https://changel.app/?r=<code>`: unfurls as this result's image. */
  url: string;
  onToast: (message: string) => void;
  /** Called with how it was shared (for analytics). */
  onShared?: (method: "share_sheet" | "clipboard" | "manual") => void;
}

/** Phones and tablets: the OS share sheet. Desktops copy instead (SPEC §10). Checked on click, not render. */
function canUseShareSheet(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;
}

/**
 * Share sheet on mobile; elsewhere copy to the clipboard with a "Copied" toast;
 * if both fail, show the text in a selectable box (the prototype's fallback).
 */
export function ShareButton({ text, teaser, url, onToast, onShared }: Props) {
  const [fallback, setFallback] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      onToast("Copied to clipboard");
      onShared?.("clipboard");
    } catch {
      setFallback(true);
      onToast("Copy the text below");
      onShared?.("manual");
      requestAnimationFrame(() => boxRef.current?.select());
    }
  };

  const share = async () => {
    if (!canUseShareSheet()) return copy();
    try {
      await navigator.share({ text: teaser, url });
      onShared?.("share_sheet");
    } catch (e) {
      // Closing the sheet isn't an error; anything else falls back to copying.
      if ((e as Error)?.name !== "AbortError") await copy();
    }
  };

  return (
    <>
      <button className="btn" id="shareBtn" type="button" onClick={share}>
        Share
      </button>
      <textarea
        ref={boxRef}
        className={fallback ? "sharebox show" : "sharebox"}
        id="shareBox"
        rows={4}
        readOnly
        value={fallback ? text : ""}
        aria-label="Your result to copy"
        aria-hidden={!fallback}
        tabIndex={fallback ? 0 : -1}
      />
    </>
  );
}
