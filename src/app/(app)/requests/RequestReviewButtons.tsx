"use client";

import { useState, useTransition } from "react";
import { reviewRequest } from "@/app/actions/requests";

export function RequestReviewButtons({
  requestId,
  approveLabel = "Approve",
}: {
  requestId: string;
  approveLabel?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  return (
    <div className="relative z-30 mt-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await reviewRequest(requestId, "APPROVED");
              if (result && !result.ok) {
                setError(result.error || "Could not approve.");
              }
            })
          }
          className="rounded-full bg-green px-3 py-1.5 text-sm text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : approveLabel}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await reviewRequest(requestId, "REJECTED");
              if (result && !result.ok) {
                setError(result.error || "Could not reject.");
              }
            })
          }
          className="rounded-full border border-line bg-card px-3 py-1.5 text-sm disabled:opacity-60"
        >
          Reject
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red">{error}</p> : null}
    </div>
  );
}
