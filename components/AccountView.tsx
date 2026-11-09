"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { deleteAccount, fetchAccount, signOut, type ServerStats } from "@/lib/game/session-client";
import { clearLocalGameData } from "@/lib/game/storage";
import { refreshFromAccount } from "@/lib/game/sync";
import { deviceTimeZone } from "@/lib/dates";
import { SaveStreak } from "./SaveStreak";

type State = { kind: "loading" } | { kind: "none" } | { kind: "error" } | { kind: "anon"; me: ServerStats } | { kind: "account"; me: ServerStats };

const SIGNIN_NOTES: Record<string, string> = {
  ok: "You're signed in on this browser.",
  expired: "That link has expired or was already used. Ask for a new code below.",
  invalid: "That link didn't work. Ask for a new code below.",
};

export function AccountView() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [banner, setBanner] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const me = await fetchAccount();
    if (me === undefined) setState({ kind: "error" });
    else if (me === null) setState({ kind: "none" });
    else setState(me.anonymous ? { kind: "anon", me } : { kind: "account", me });
  }, []);

  useEffect(() => {
    const signin = new URLSearchParams(window.location.search).get("signin");
    const id = requestAnimationFrame(() => {
      if (signin && SIGNIN_NOTES[signin]) setBanner(SIGNIN_NOTES[signin]);
      void refresh();
    });
    return () => cancelAnimationFrame(id);
  }, [refresh]);

  const doSignOut = async () => {
    setBusy(true);
    await signOut();
    clearLocalGameData(); // fresh anonymous state (SPEC §5)
    router.push("/");
  };

  const doDelete = async () => {
    setBusy(true);
    const ok = await deleteAccount();
    if (!ok) {
      setBusy(false);
      setBanner("Couldn't delete your account. Try again.");
      return;
    }
    clearLocalGameData();
    router.push("/");
  };

  return (
    <>
      {banner && <p className="banner" role="status">{banner}</p>}

      {state.kind === "loading" && <p className="note">Loading…</p>}
      {state.kind === "error" && <p>We couldn&apos;t load your account. Check your connection and try again.</p>}

      {state.kind === "none" && (
        <>
          <SaveStreak mode="signin" title="Sign in" onDone={async () => { await refreshFromAccount(deviceTimeZone()); void refresh(); }} />
        </>
      )}

      {state.kind === "anon" && (
        <>
          <SaveStreak mode="save" onDone={async () => { await refreshFromAccount(deviceTimeZone()); void refresh(); }} />
        </>
      )}

      {state.kind === "account" && (
        <>
          <p>
            Signed in as <b>{state.me.email}</b>. You&apos;ll stay signed in on this browser.
          </p>
          <div className="stats">
            <div><b>{state.me.games_played}</b><small>played</small></div>
            <div><b>{state.me.current_streak}</b><small>streak</small></div>
            <div><b>{state.me.best_total ?? 0}</b><small>best</small></div>
          </div>

          {changing ? (
            <SaveStreak mode="change" onDone={() => { setChanging(false); void refresh(); }} />
          ) : (
            <div className="account-rows">
              <button className="btn ghost" type="button" onClick={() => setChanging(true)}>Change email</button>
              <button className="btn ghost" type="button" onClick={doSignOut} disabled={busy}>Sign out</button>
            </div>
          )}

          {confirmDelete ? (
            <div className="account-rows">
              <p>This deletes your account and every game you&apos;ve played. It can&apos;t be undone.</p>
              <button className="danger solid" type="button" onClick={doDelete} disabled={busy} aria-busy={busy}>Delete for good</button>
              <button className="btn ghost" type="button" onClick={() => setConfirmDelete(false)}>Keep my account</button>
            </div>
          ) : (
            <button className="danger" type="button" onClick={() => setConfirmDelete(true)}>Delete my account</button>
          )}
        </>
      )}
    </>
  );
}
