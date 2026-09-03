"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { runStudentImport } from "@/lib/run-student-import";

export function ImportForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [doneCount, setDoneCount] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  return (
    <form
      className="rounded-2xl border border-line bg-card p-6"
      onSubmit={(event) => {
        event.preventDefault();
        const file = inputRef.current?.files?.[0];
        if (!file) {
          setMessage("First click Choose file, then click Upload file.");
          return;
        }
        const overwrite =
          event.currentTarget.overwrite instanceof HTMLInputElement &&
          event.currentTarget.overwrite.checked;
        setPending(true);
        setDoneCount(null);
        setErrors([]);
        setMessage("Loading the full list in small groups. Stay on this page.");
        void (async () => {
          const result = await runStudentImport({
            file,
            overwrite,
            onProgress: (progress) => {
              setMessage(
                `Loading ${Math.min(progress.processed, progress.total || progress.processed)} of ${progress.total || "…"}. Added ${progress.created} new. ${progress.skipped} already on the list. ${progress.excludedNotReturning} Not Returning skipped.`,
              );
            },
          });
          setPending(false);
          if (!result.ok) {
            setErrors(result.progress.errors.slice(0, 8));
            setMessage(
              `${result.error} Added ${result.progress.created} so far. Keep the same file selected and click Upload file again. Names already on the list are skipped.`,
            );
            return;
          }
          setErrors(result.errors.slice(0, 8));
          setDoneCount(result.rosterStudents);
          setMessage(
            `Finished. ${result.rosterStudents} students are on the roster. Added ${result.created} new${result.updated ? `, updated ${result.updated}` : ""}. ${result.excludedNotReturning} Not Returning were left out on purpose.`,
          );
        })();
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
          {pending ? "Loading students…" : "2. Load all students"}
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
      {message ? (
        <p className="mt-3 rounded-xl border border-green bg-green-50 px-4 py-3 text-base font-semibold text-green">
          {message}
        </p>
      ) : null}
      {doneCount != null ? (
        <p className="mt-3 text-base font-semibold">
          <Link href="/gate" className="text-navy underline">
            Open The Gate ({doneCount} students)
          </Link>
        </p>
      ) : null}
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
