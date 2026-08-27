"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { emailTeacherLists } from "@/app/actions/email";

const kinds = [
  ["teacher", "Teachers"],
  ["master", "All students"],
  ["bus", "Buses"],
  ["pickup", "Parent pickup"],
  ["changes", "Today’s changes"],
  ["missing", "Waiting for a bus"],
  ["company", "Bus company"],
  ["checkin", "Bus check-in"],
];

export function PrintActions({ isTeacher }: { isTeacher: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const selected = params.get("kind") || "teacher";
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
        {!isTeacher ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await emailTeacherLists();
                setMessage(
                  result.ok
                    ? `Emailed ${result.sent} classroom lists.`
                    : result.error || "Could not send.",
                );
              })
            }
            className="rounded-xl border border-line bg-card px-5 py-2.5 text-sm font-semibold"
          >
            {pending ? "Emailing…" : "Email teachers"}
          </button>
        ) : null}
      </div>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </div>
  );
}
