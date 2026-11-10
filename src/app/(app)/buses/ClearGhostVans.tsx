"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearGhostVanAssignments } from "@/app/actions/roster";

export function ClearGhostVans() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [warn, setWarn] = useState(false);

  function closeWarn() {
    if (!pending) setWarn(false);
  }

  function clearVans() {
    start(async () => {
      const result = await clearGhostVanAssignments();
      if (!result.ok) {
        setMessage(result.error);
        setWarn(false);
        return;
      }
      setMessage(
        result.cleared || result.removedVehicles
          ? `Removed mistaken van links (${result.cleared} rides, ${result.removedVehicles} van names). Bus lists stay. Load real VAN_6.xlsx files next.`
          : "No van mistakes found.",
      );
      setWarn(false);
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <button
        type="button"
        disabled={pending}
        onClick={() => setWarn(true)}
        className="text-sm font-semibold text-navy disabled:opacity-50"
      >
        Wrong Van 2 from a bus file? Clear mistaken vans
      </button>
      <p className="mt-2 text-sm text-muted">
        Use this before you load real van Excel files. It removes ghost Van
        names (like Amal on Van 2 after Bus 2 PM) and keeps Bus 1 / Bus 2.
      </p>
      {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}

      {warn ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-vans-title"
          onClick={closeWarn}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="clear-vans-title" className="font-serif text-2xl text-navy">
              Clear mistaken vans?
            </h3>
            <p className="mt-2 text-sm text-navy">
              This removes Van 1 / Van 2 links created by mistake. Bus
              assignments stay. Then upload your real van files.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={closeWarn}
                className="rounded-xl border border-line px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={clearVans}
                className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Clearing…" : "Yes, clear vans"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
