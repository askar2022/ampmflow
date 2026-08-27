"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { emailTeacherLists } from "@/app/actions/email";

const kinds = [
  ["teacher", "One list per teacher"],
  ["master", "Master dismissal list"],
  ["bus", "List for each bus"],
  ["pickup", "Parent-pickup list"],
  ["changes", "Temporary changes only"],
  ["missing", "Missing assignments"],
  ["company", "Bus-company change report"],
  ["checkin", "Today’s bus check-in"],
];

export function PrintActions({ isTeacher }: { isTeacher: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const selected = params.get("kind") || "teacher";
  const visible = isTeacher ? kinds.filter(([kind]) => kind === "teacher") : kinds;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => window.print()}
          className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white"
        >
          Print this list
        </button>
        {!isTeacher ? (
          <button
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
            className="rounded-xl border border-line bg-card px-4 py-2 text-sm font-semibold"
          >
            {pending ? "Emailing…" : "Email each teacher their list"}
          </button>
        ) : null}
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        {visible.map(([kind, label]) => (
          <div
            key={kind}
            className={`flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 first:border-t-0 ${
              selected === kind ? "bg-paper" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => router.push(`/print?kind=${kind}`)}
              className="text-left text-sm font-semibold"
            >
              {label}
            </button>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push(`/print?kind=${kind}`)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  selected === kind
                    ? "bg-navy text-white"
                    : "border border-line bg-card"
                }`}
              >
                View
              </button>
              <a
                href={`/print/export?kind=${kind}`}
                className="rounded-full border border-line bg-card px-3 py-1.5 text-sm font-semibold"
              >
                Download Excel
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
