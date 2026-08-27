"use client";

import { useState, useTransition } from "react";
import { emailTeacherLists } from "@/app/actions/email";

export function EmailTeacherButton({
  group,
  label,
  disabled = false,
}: {
  group?: string;
  label: string;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const oneTeacher = Boolean(group);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending || disabled}
        onClick={() =>
          start(async () => {
            const result = await emailTeacherLists(group);
            if (!result.ok) {
              setMessage(result.error || "Could not send.");
              return;
            }
            const sentTo = result.recipients
              ?.map((row) => `${row.name} (${row.email})`)
              .join(", ");
            setMessage(
              oneTeacher
                ? `Sent this class list to ${sentTo || "no one"}.`
                : `Sent every class list to ${sentTo || "no one"}.`,
            );
          })
        }
        className="inline-flex w-full items-center justify-center rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
      >
        {pending ? "Emailing…" : label}
      </button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </div>
  );
}
