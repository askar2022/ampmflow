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

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {(isTeacher
          ? kinds.filter(([k]) => k === "teacher")
          : kinds
        ).map(
          ([kind, label]) => (
            <button
              key={kind}
              onClick={() => router.push(`/print?kind=${kind}`)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                (params.get("kind") || "teacher") === kind
                  ? "bg-navy text-white"
                  : "border border-line bg-card"
              }`}
            >
              {label}
            </button>
          ),
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => window.print()}
          className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white"
        >
          Print all classrooms
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
    </div>
  );
}
