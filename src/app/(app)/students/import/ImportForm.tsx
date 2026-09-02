"use client";

import { useRef, useState, useTransition } from "react";
import { importStudents } from "@/app/actions/import";

export function ImportForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  return (
    <form
      className="rounded-2xl border border-line bg-card p-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (!inputRef.current?.files?.length) {
          setMessage("First click Choose file, then click Upload file.");
          return;
        }
        const data = new FormData(event.currentTarget);
        start(async () => {
          const result = await importStudents(data);
          if (!result.ok) {
            setMessage(result.error || "Import failed.");
            setErrors([]);
            return;
          }
          setMessage(
            `Imported ${result.created} new students and updated ${result.updated}.`,
          );
          setErrors(result.errors ?? []);
        });
      }}
    >
      <input
        ref={inputRef}
        id="student-file"
        name="file"
        type="file"
        accept=".csv,.xlsx,.xls"
        className="sr-only"
        onChange={(event) => setFileName(event.target.files?.[0]?.name || "")}
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          className="action-button-secondary inline-flex min-h-12 items-center justify-center rounded-xl px-6 text-lg font-bold"
          onClick={() => inputRef.current?.click()}
        >
          1. Choose file
        </button>
        <button
          type="submit"
          disabled={pending || !fileName}
          className="action-button inline-flex min-h-12 items-center justify-center rounded-xl px-6 text-lg font-bold disabled:opacity-60"
        >
          {pending ? "Uploading…" : "2. Upload file"}
        </button>
      </div>
      <p className="mt-3 text-sm font-medium text-navy">
        {fileName ? `Selected: ${fileName}` : "No file chosen yet."}
      </p>
      <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="overwrite" />
        Update existing students (overwrite confirmed)
      </label>
      <input type="hidden" name="enrollmentSource" value="RETURNING" />
      {message ? <p className="mt-3 text-sm">{message}</p> : null}
      {errors.length ? (
        <ul className="mt-2 list-disc pl-5 text-sm text-red">
          {errors.slice(0, 8).map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
