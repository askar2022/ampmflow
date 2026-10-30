"use client";

import { useState, useTransition } from "react";
import { sendFridaySnapshotTest } from "@/app/actions/analytics";

export function FridayTestEmail({ email }: { email: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");

  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <h2 className="text-lg font-semibold text-navy">Test the Friday email</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Send this school’s Friday snapshot to you only. Open it on your phone
        before next Friday. Metro leadership will not get this test.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await sendFridaySnapshotTest();
            setMessage(
              result.ok
                ? `Sent a test to ${result.to}. Check your phone.`
                : result.error || "Could not send the test.",
            );
          })
        }
        className="mt-4 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Sending…" : `Send test to ${email}`}
      </button>
      {message ? <p className="mt-3 text-sm text-navy">{message}</p> : null}
    </div>
  );
}
