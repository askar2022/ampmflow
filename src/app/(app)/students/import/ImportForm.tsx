"use client";

import { useState, useTransition } from "react";
import { importStudents } from "@/app/actions/import";

export function ImportForm() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");

  return (
    <form
      className="rounded-2xl border border-line bg-card p-6"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        start(async () => {
          const result = await importStudents(data);
          if (!result.ok) {
            setMessage(result.error || "Import failed.");
            return;
          }
          setMessage(
            `Imported ${result.created} new students and updated ${result.updated}.${
              result.errors?.length ? ` ${result.errors.length} rows had issues.` : ""
            }`,
          );
        });
      }}
    >
      <input
        name="file"
        type="file"
        accept=".csv,.xlsx,.xls"
        required
        className="block w-full text-sm"
      />
      <button
        disabled={pending}
        className="mt-4 rounded-xl bg-navy px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Importing…" : "Import students"}
      </button>
      {message ? <p className="mt-3 text-sm">{message}</p> : null}
    </form>
  );
}
