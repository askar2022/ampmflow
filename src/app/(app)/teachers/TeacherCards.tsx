"use client";

import { useState } from "react";
import Link from "next/link";
import { saveTeacherProfile } from "@/app/actions/teachers";
import { EmailTeacherButton } from "@/components/EmailTeacherButton";

export type TeacherCardData = {
  id: string;
  name: string;
  email: string;
  grade: string;
  room: string;
  studentCount: number;
  rosterHref: string;
  groupName: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function TeacherCards({
  teachers,
  canEdit,
  canEmail = false,
}: {
  teachers: TeacherCardData[];
  canEdit: boolean;
  canEmail?: boolean;
}) {
  const [editing, setEditing] = useState<TeacherCardData | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
        {teachers.map((teacher) => (
          <article
            key={teacher.id}
            className="flex h-full flex-col rounded-[16px] border border-line bg-card p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-teal text-sm font-medium text-white"
                aria-hidden
              >
                {initials(teacher.name)}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-medium leading-tight text-navy">
                  {teacher.name}
                </h2>
                {teacher.email ? (
                  <p className="mt-1 truncate text-sm text-ink">{teacher.email}</p>
                ) : (
                  <p className="mt-1 text-sm text-muted">No email saved</p>
                )}
                <span
                  className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-sm font-medium ${
                    teacher.email
                      ? "bg-green/15 text-green"
                      : "bg-red/10 text-red"
                  }`}
                >
                  {teacher.email ? "Email ready" : "Missing email"}
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <InfoBox label="Grade" value={teacher.grade || "—"} />
              <InfoBox label="Room number" value={teacher.room || "—"} />
              <Link
                href={teacher.rosterHref}
                className="rounded-xl border border-line bg-paper px-2 py-2 text-center hover:border-teal"
              >
                <div className="text-xs font-medium text-muted">Number of students</div>
                <div className="mt-1 text-base font-medium text-navy">
                  {teacher.studentCount}
                </div>
              </Link>
            </div>

            <div className="mt-auto flex flex-col gap-2 pt-4">
              {!teacher.email && canEdit ? (
                <button
                  type="button"
                  onClick={() => setEditing(teacher)}
                  className="rounded-xl border border-teal px-3 py-2 text-sm font-medium text-teal"
                >
                  Add Email
                </button>
              ) : null}
              {canEmail ? (
                <EmailTeacherButton
                  group={teacher.groupName}
                  label={`Email ${teacher.name} only`}
                  disabled={!teacher.email}
                />
              ) : null}
              <Link
                href={teacher.rosterHref}
                className="action-button inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium"
              >
                View Class Roster
              </Link>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setEditing(teacher)}
                  className="action-button-secondary inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium"
                >
                  Edit Teacher
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {editing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4"
          onClick={() => setEditing(null)}
        >
          <form
            action={async (formData) => {
              await saveTeacherProfile(formData);
              setEditing(null);
            }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-[16px] border border-line bg-card p-6 shadow-lg"
          >
            <h3 className="text-xl font-medium text-navy">Edit teacher</h3>
            <p className="mt-1 text-sm text-muted">
              Change the name, email, grade, or room. This does not change the
              student list.
            </p>
            <input type="hidden" name="teacherId" value={editing.id} />
            <label className="mt-4 block text-sm font-medium">
              Teacher name
              <input
                name="name"
                required
                defaultValue={editing.name}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2"
              />
            </label>
            <label className="mt-3 block text-sm font-medium">
              Email
              <input
                name="email"
                type="email"
                defaultValue={editing.email}
                placeholder="teacher@school.org"
                className="mt-1 w-full rounded-xl border border-line px-3 py-2"
              />
            </label>
            <label className="mt-3 block text-sm font-medium">
              Grade
              <input
                name="grade"
                required
                defaultValue={editing.grade}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2"
              />
            </label>
            <label className="mt-3 block text-sm font-medium">
              Room number
              <input
                name="classroomName"
                required
                defaultValue={editing.room}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-navy"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="action-button rounded-xl px-4 py-2 text-sm font-medium"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper px-2 py-2 text-center">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 text-base font-medium text-navy">{value}</div>
    </div>
  );
}
