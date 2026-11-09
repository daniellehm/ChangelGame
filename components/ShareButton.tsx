"use client";

import { useRef, useState } from "react";

interface Props {
  text: string;
  onToast: (message: string) => void;
}

/**
 * Prototype behaviour: copy to clipboard, else show the text in a selectable
 * box. (M6 adds navigator.share on mobile, SPEC §10.)
 */
export function ShareButton({ text, onToast }: Props) {
  const [fallback, setFallback] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(text);
      onToast("Copied to clipboard");
    } catch {
      setFallback(true);
      onToast("Copy the text below");
      requestAnimationFrame(() => boxRef.current?.select());
    }
  };

  return (
    <>
      <button className="btn" id="shareBtn" type="button" onClick={share}>
        Share result
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
