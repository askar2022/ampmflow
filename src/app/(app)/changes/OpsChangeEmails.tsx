"use client";

import { useState, useTransition } from "react";
import {
  addChangeListEmail,
  emailOpsChangeListNow,
  removeChangeListEmail,
} from "@/app/actions/ops-emails";

export function OpsChangeEmails({
  emails,
  canEdit,
  lastSent,
  sendAt,
}: {
  emails: string[];
  canEdit: boolean;
  lastSent?: string | null;
  sendAt: string;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <h2 className="text-xl font-semibold text-navy">
        Leadership and bus coordinator
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Add emails here — not on the Front Desk change form. These people get
        each change when it is saved, and the {sendAt} list if anyone changed.
        Parent and teacher stay on the change form.
      </p>
      {emails.length ? (
        <ul className="mt-4 space-y-2">
          {emails.map((email) => (
            <li
              key={email}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-sm"
            >
              <span>{email}</span>
              {canEdit ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const result = await removeChangeListEmail(email);
                      setMessage(result.ok ? "Removed." : result.error || "Could not remove.");
                    })
                  }
                  className="text-sm font-semibold text-red disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-red">
          No emails saved yet. The 2:30 send waits until you add them.
        </p>
      )}
      {canEdit ? (
        <form
          className="mt-4 flex flex-wrap gap-2"
          action={(formData) =>
            start(async () => {
              const result = await addChangeListEmail(formData);
              if (result.ok) setEmail("");
              setMessage(
                result.ok
                  ? "Saved. That person will get the next 2:30 list."
                  : result.error || "Could not save.",
              );
            })
          }
        >
          <input
            name="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@school.org"
            className="min-w-[220px] flex-1 rounded-xl border border-line px-3 py-2"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Saving…" : "Add email"}
          </button>
          <button
            type="button"
            disabled={pending || emails.length === 0}
            onClick={() =>
              start(async () => {
                const result = await emailOpsChangeListNow();
                if (!result.ok) {
                  setMessage(result.error || "Could not send.");
                  return;
                }
                if (result.skippedEmpty) {
                  setMessage("No students changed today, so no email was sent.");
                  return;
                }
                const sentTo = result.recipients.join(", ");
                setMessage(
                  sentTo
                    ? `Sent from dismissal@ampmflow.com to ${sentTo}.`
                    : "Sent.",
                );
              })
            }
            className="rounded-xl border border-line bg-card px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {pending ? "Sending…" : "Email today’s changes now"}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Reception only saves the change on the desk. The {sendAt} reminder
          is automatic.
        </p>
      )}
      {lastSent ? (
        <p className="mt-3 text-sm text-muted">Last emailed {lastSent}.</p>
      ) : null}
      {message ? <p className="mt-2 text-sm text-muted">{message}</p> : null}
    </section>
  );
}
