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
  canEmail = false,
  ready = [],
  missing = [],
  group = "",
}: {
  isTeacher: boolean;
  canEmail?: boolean;
  ready?: { name: string; email: string }[];
  missing?: { name: string }[];
  group?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const selected =
    params.get("kind") === "missing"
      ? "company"
      : params.get("kind") || "teacher";
  const oneClass = selected === "teacher" && Boolean(group);
  const visible = isTeacher ? kinds.filter(([kind]) => kind === "teacher") : kinds;
  const exportHref = oneClass
    ? `/print/export?kind=${selected}&group=${encodeURIComponent(group)}`
    : `/print/export?kind=${selected}`;

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
          <p className="font-semibold text-navy">
            {oneClass ? "This class list" : "Teacher emails"}
          </p>
          <p className="mt-1 text-muted">
            {oneClass
              ? `This page is only for ${group}. The button below emails this teacher, not the whole school.`
              : "Save emails once on Teachers. After that, Vercel sends the list every school day by itself. Use Email all teachers only when you want to send every class now."}
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
              {oneClass
                ? "This teacher has no email yet. Add it on Teachers first."
                : "No teacher emails saved yet. The daily send and this button will wait until you add them."}
            </p>
          )}
          {missing.length ? (
            <p className="mt-3">
              Still need an email for:{" "}
              {missing.map((row) => row.name).join(", ")}.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-4">
            <Link href="/teachers" className="font-semibold text-navy">
              {oneClass ? "Back to teachers" : "Add teacher emails"}
            </Link>
            {oneClass ? (
              <Link href="/print?kind=teacher" className="font-semibold text-navy">
                See all class lists
              </Link>
            ) : null}
          </div>
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
          href={exportHref}
          className="rounded-xl border border-line bg-card px-5 py-2.5 text-sm font-semibold"
        >
          Download Excel
        </a>
        {canEmail && selected === "teacher" ? (
          <button
            type="button"
            disabled={pending || ready.length === 0}
            onClick={() =>
              start(async () => {
                const result = await emailTeacherLists(oneClass ? group : undefined);
                if (!result.ok) {
                  setMessage(result.error || "Could not send.");
                  return;
                }
                const sentTo = result.recipients
                  ?.map((row) => `${row.name} (${row.email})`)
                  .join(", ");
                const stillNeed = result.missing?.map((row) => row.name).join(", ");
                setMessage(
                  oneClass
                    ? `Sent this class list to ${sentTo || "no one"}.`
                    : `Sent from dismissal@ampmflow.com to ${sentTo || "no one"}.${
                        stillNeed ? ` Still need emails for ${stillNeed}.` : ""
                      }`,
                );
              })
            }
            className="rounded-xl border border-line bg-card px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {pending
              ? "Emailing…"
              : oneClass
                ? "Email this teacher"
                : "Email all teachers"}
          </button>
        ) : null}
      </div>
      {message && selected === "teacher" ? (
        <p className="text-sm text-muted">{message}</p>
      ) : null}
    </div>
  );
}
