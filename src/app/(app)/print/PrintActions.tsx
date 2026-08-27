"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { EmailTeacherButton } from "@/components/EmailTeacherButton";

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
  const selected =
    params.get("kind") === "missing"
      ? "company"
      : params.get("kind") || "teacher";
  const groupFromUrl = params.get("group") || group || "";
  const oneClass = selected === "teacher" && Boolean(groupFromUrl);
  const visible = isTeacher ? kinds.filter(([kind]) => kind === "teacher") : kinds;
  const exportHref = oneClass
    ? `/print/export?kind=${selected}&group=${encodeURIComponent(groupFromUrl)}`
    : `/print/export?kind=${selected}`;
  const thisTeacher =
    ready.find((row) => row.name === groupFromUrl) ||
    (ready.length === 1 ? ready[0] : null);
  const thisMissing = missing.find((row) => row.name === groupFromUrl);

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

      {oneClass ? (
        <div className="rounded-2xl border border-line bg-card p-5 text-sm">
          <p className="font-semibold text-navy">Email this teacher only</p>
          <p className="mt-1 text-muted">
            This page is {groupFromUrl}. It does not email the other teachers.
            To email everyone at once, open Teachers or All class lists.
          </p>
          {thisTeacher ? (
            <p className="mt-3">
              {thisTeacher.name} → {thisTeacher.email}
            </p>
          ) : (
            <p className="mt-3 text-red">
              {thisMissing
                ? `${thisMissing.name} has no email yet. Add it on Teachers first.`
                : "This teacher has no email yet. Add it on Teachers first."}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-4">
            <Link href="/teachers" className="font-semibold text-navy">
              Back to teachers
            </Link>
            <Link href="/print?kind=teacher" className="font-semibold text-navy">
              Email all teachers
            </Link>
          </div>
        </div>
      ) : null}

      {!isTeacher && selected === "teacher" && !oneClass ? (
        <div className="rounded-2xl border border-line bg-card p-5 text-sm">
          <p className="font-semibold text-navy">Email all teachers</p>
          <p className="mt-1 text-muted">
            This sends every class list at once. To email one teacher, open
            that class on Teachers.
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
              No teacher emails saved yet. Add them on Teachers first.
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

      <div className="flex flex-wrap items-start gap-2">
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
        {canEmail && selected === "teacher" && oneClass ? (
          <div className="min-w-[220px]">
            <EmailTeacherButton
              group={groupFromUrl}
              label="Email this teacher only"
              disabled={!thisTeacher}
            />
          </div>
        ) : null}
        {canEmail && selected === "teacher" && !oneClass ? (
          <div className="min-w-[220px]">
            <EmailTeacherButton
              label="Email all teachers"
              disabled={ready.length === 0}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
