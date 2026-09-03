"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { importStudents } from "@/app/actions/import";

export function ImportForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [pending, setPending] = useState(false);
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
        setPending(true);
        setMessage(
          "Uploading the full list. Stay on this page. A Sankofa file can take up to one minute. Do not click again.",
        );
        void importStudents(data)
          .then((result) => {
            if (!result?.ok) {
              setPending(false);
              setMessage(result?.error || "Import failed. Try the upload again.");
              setErrors([]);
              return;
            }
            router.push(
              `/students?imported=${result.created ?? 0}&updated=${result.updated ?? 0}&issues=${result.errors?.length ?? 0}`,
            );
          })
          .catch(() => {
            setPending(false);
            setMessage(
              "The upload did not finish. Stay on this page and click Upload file again.",
            );
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
      {message ? (
        <p className="mt-3 rounded-xl border border-green bg-green-50 px-4 py-3 text-base font-semibold text-green">
          {message}
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
