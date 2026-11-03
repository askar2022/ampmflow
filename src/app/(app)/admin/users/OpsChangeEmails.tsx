"use client";

import { useState, useTransition } from "react";
import {
  addChangeListEmail,
  addLeadershipListEmail,
  emailOpsChangeListNow,
  removeChangeListEmail,
  removeLeadershipListEmail,
} from "@/app/actions/ops-emails";

function EmailBox({
  title,
  help,
  emails,
  lastSent,
  add,
  remove,
  sendNowLabel,
  onSendNow,
  empty,
}: {
  title: string;
  help: string;
  emails: string[];
  lastSent?: string | null;
  add: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  remove: (email: string) => Promise<{ ok: boolean; error?: string }>;
  sendNowLabel?: string;
  onSendNow?: () => Promise<string>;
  empty: string;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <h2 className="text-xl font-semibold text-navy">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">{help}</p>
      {emails.length ? (
        <ul className="mt-4 space-y-2">
          {emails.map((address) => (
            <li
              key={address}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-sm"
            >
              <span>{address}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await remove(address);
                    setMessage(
                      result.ok ? "Removed." : result.error || "Could not remove.",
                    );
                  })
                }
                className="text-sm font-semibold text-red disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">{empty}</p>
      )}
      <form
        className="mt-4 flex flex-wrap gap-2"
        action={(formData) =>
          start(async () => {
            const result = await add(formData);
            if (result.ok) setEmail("");
            setMessage(
              result.ok ? "Saved." : result.error || "Could not save.",
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
        {onSendNow ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setMessage(await onSendNow());
              })
            }
            className="rounded-xl border border-line bg-card px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {pending ? "Sending…" : sendNowLabel}
          </button>
        ) : null}
      </form>
      {lastSent ? (
        <p className="mt-3 text-sm text-muted">Last emailed {lastSent}.</p>
      ) : null}
      {message ? <p className="mt-2 text-sm text-muted">{message}</p> : null}
    </section>
  );
}

export function OpsChangeEmails({
  reminderEmails,
  leadershipEmails,
  lastSent,
  sendAt,
}: {
  reminderEmails: string[];
  leadershipEmails: string[];
  lastSent?: string | null;
  sendAt: string;
}) {
  return (
    <div className="space-y-4">
      <EmailBox
        title="2:30 reminder"
        help={`If anyone changed today, this reminder goes at ${sendAt} to the parent, teacher, bus company, and bus coordinator on the student form. Add extra reminder emails here. Daily Front Desk changes still go out right away from the student form.`}
        emails={reminderEmails}
        lastSent={lastSent}
        add={addChangeListEmail}
        remove={removeChangeListEmail}
        empty="No extra reminder emails yet. Parents, teachers, the bus company, and coordinators still get the 2:30 list from the student form."
        sendNowLabel="Send 2:30 reminder now"
        onSendNow={async () => {
          const result = await emailOpsChangeListNow();
          if (!result.ok) return result.error || "Could not send.";
          if (result.skippedEmpty) {
            return "No students changed today, so no email was sent.";
          }
          return result.recipients.length
            ? `Sent to ${result.recipients.join(", ")}.`
            : "Sent.";
        }}
      />
      <EmailBox
        title="Friday leadership email"
        help="These emails get the Friday noon analytics snapshot only. They do not get each Front Desk change or the 2:30 reminder."
        emails={leadershipEmails}
        add={addLeadershipListEmail}
        remove={removeLeadershipListEmail}
        empty="Add the leadership emails that should get Friday analytics."
      />
    </div>
  );
}
