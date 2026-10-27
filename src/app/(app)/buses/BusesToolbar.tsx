"use client";

import { useState, useTransition } from "react";
import { emailBusVanList } from "@/app/actions/ridership";

export function BusesToolbar() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");

  return (
    <div className="no-print mt-3 space-y-2">
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
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await emailBusVanList();
              setMessage(
                result.ok
                  ? `Emailed ${result.recipients.join(", ")}.`
                  : result.error,
              );
            })
          }
          className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Sending…" : "Email list"}
        </button>
      </div>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </div>
  );
}
