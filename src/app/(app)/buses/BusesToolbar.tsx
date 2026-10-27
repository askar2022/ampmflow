"use client";

import { useState, useTransition } from "react";
import { emailBusVanList } from "@/app/actions/ridership";

export function BusesToolbar({ suggested = [] }: { suggested?: string[] }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [to, setTo] = useState(suggested.join(", "));

  return (
    <div className="no-print mt-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl border border-line bg-card px-4 py-2 text-sm font-semibold"
        >
          Print all for drivers
        </button>
        <a
          href="/print/export?kind=bus"
          className="rounded-xl border border-line bg-card px-4 py-2 text-sm font-semibold"
        >
          Download Excel
        </a>
      </div>
      <div className="max-w-xl rounded-2xl border border-line bg-card p-4">
        <label className="block text-sm font-semibold text-navy" htmlFor="bus-list-to">
          Email this list to
          <input
            id="bus-list-to"
            type="text"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder="Bus company or driver email"
            className="mt-1 w-full rounded-xl border border-line px-3 py-2 font-normal"
          />
        </label>
        <p className="mt-1 text-xs text-muted">
          Type who should get today’s bus and van list. Separate more than one
          email with a comma.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await emailBusVanList(to);
              setMessage(
                result.ok
                  ? `Emailed ${result.recipients.join(", ")}.`
                  : result.error,
              );
            })
          }
          className="mt-3 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Sending…" : "Email list"}
        </button>
        {message ? <p className="mt-2 text-sm text-muted">{message}</p> : null}
      </div>
    </div>
  );
}
