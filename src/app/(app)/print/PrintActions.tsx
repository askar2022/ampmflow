"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { emailTeacherLists } from "@/app/actions/email";

const kinds = [
  ["teacher", "Teachers"],
  ["master", "All students"],
  ["bus", "Buses"],
  ["pickup", "Parent pickup"],
  ["changes", "Today’s changes"],
  ["company", "Bus company"],
  ["checkin", "Bus check-in"],
];

export function PrintActions({
  isTeacher,
  ready = [],
  missing = [],
}: {
  isTeacher: boolean;
  ready?: { name: string; email: string }[];
  missing?: { name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const selected =
    params.get("kind") === "missing"
      ? "company"
      : params.get("kind") || "teacher";
  const visible = isTeacher ? kinds.filter(([kind]) => kind === "teacher") : kinds;

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-2xl border border-line bg-card p-5">
        <p className="text-sm font-semibold text-navy">Choose a list</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {visible.map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              onClick={() => router.push(`/print?kind=${kind}`)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                selected === kind
                  ? "bg-navy text-white"
                  : "border border-line bg-paper text-navy"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {!isTeacher && selected === "teacher" ? (
        <div className="rounded-2xl border border-line bg-card p-5 text-sm">
          <p className="font-semibold text-navy">Teacher emails</p>
          <p className="mt-1 text-muted">
            Save emails once on Teachers. After that, Vercel sends the list
            every school day by itself. Use Email teachers only when you want
            to send it now.
          </p>
          {ready.length ? (
            <ul className="mt-3 space-y-1">
              {ready.map((row) => (
                <li key={row.name}>
                  {row.name} → {row.email}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-red">
              No teacher emails saved yet. The daily send and this button will
              wait until you add them.
            </p>
          )}
          {missing.length ? (
            <p className="mt-3">
              Still need an email for:{" "}
              {missing.map((row) => row.name).join(", ")}.
            </p>
          ) : null}
          <Link href="/teachers" className="mt-3 inline-block font-semibold text-navy">
            Add teacher emails
          </Link>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl bg-navy px-5 py-2.5 text-sm font-semibold text-white"
        >
          Print this list
        </button>
        <a
          href={`/print/export?kind=${selected}`}
          className="rounded-xl border border-line bg-card px-5 py-2.5 text-sm font-semibold"
        >
          Download Excel
        </a>
        {!isTeacher && selected === "teacher" ? (
          <button
            type="button"
            disabled={pending || ready.length === 0}
            onClick={() =>
              start(async () => {
                const result = await emailTeacherLists();
                if (!result.ok) {
                  setMessage(result.error || "Could not send.");
                  return;
                }
                const sentTo = result.recipients
                  ?.map((row) => `${row.name} (${row.email})`)
                  .join(", ");
                const stillNeed = result.missing?.map((row) => row.name).join(", ");
                setMessage(
                  `Sent from dismissal@ampmflow.com to ${sentTo || "no one"}.${
                    stillNeed ? ` Still need emails for ${stillNeed}.` : ""
                  }`,
                );
              })
            }
            className="rounded-xl border border-line bg-card px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {pending ? "Emailing…" : "Email teachers"}
          </button>
        ) : null}
      </div>
      {message && selected === "teacher" ? (
        <p className="text-sm text-muted">{message}</p>
      ) : null}
    </div>
  );
}
