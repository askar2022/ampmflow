"use client";

import { useState } from "react";
import { roleLabel } from "@/lib/format";
import { UserRemoveButton } from "./UserRemoveButton";

type ArchivedUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};

export function UserArchive({ users }: { users: ArchivedUser[] }) {
  const [open, setOpen] = useState(false);

  if (!users.length) return null;

  return (
    <section className="rounded-2xl border border-line bg-card">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span>
          <span className="font-serif text-2xl">Archive</span>
          <span className="ml-2 text-base text-muted">({users.length})</span>
        </span>
        <span className="text-sm font-semibold text-navy">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open ? (
        <div className="border-t border-line px-5 pb-5">
          <p className="mt-3 text-muted">
            These people cannot sign in. Put back restores them to the Users
            list.
          </p>
          <ul className="mt-4 space-y-3">
            {users.map((user) => (
              <li
                key={user.id}
                className="rounded-xl border border-line px-4 py-3"
              >
                <div className="font-semibold text-navy">{user.name}</div>
                <div className="text-sm text-navy">{user.email}</div>
                <div className="mt-1 text-sm text-muted">
                  {roleLabel(user.role)} · Archived
                </div>
                <div className="mt-3">
                  <UserRemoveButton id={user.id} active={user.active} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
