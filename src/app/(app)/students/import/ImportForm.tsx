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
        const file = inputRef.current?.files?.[0];
        if (!file) {
          setMessage("First click Choose file, then click Upload file.");
          return;
        }
        const overwrite =
          event.currentTarget.overwrite instanceof HTMLInputElement &&
          event.currentTarget.overwrite.checked;
        setPending(true);
        setErrors([]);
        setMessage("Adding missing students. Stay on this page. Do not click again.");
        void (async () => {
          let created = 0;
          let updated = 0;
          let skipped = 0;
          let next = 0;
          let done = false;
          const allErrors: string[] = [];
          try {
            while (!done) {
              const data = new FormData();
              data.set("file", file);
              data.set("enrollmentSource", "RETURNING");
              data.set("batchStart", String(next));
              if (overwrite) data.set("overwrite", "on");
              const result = await importStudents(data);
              if (!result?.ok) {
                setPending(false);
                setMessage(result?.error || "Import failed. Try the upload again.");
                return;
              }
              created += result.created ?? 0;
              updated += result.updated ?? 0;
              skipped += result.skipped ?? 0;
              allErrors.push(...(result.errors || []));
              next = result.next ?? next + 15;
              done = Boolean(result.done);
              const total = result.sourceStudents || next;
              setMessage(
                `Uploading ${next} of ${total}. Added ${created} new. ${skipped} already on the list.`,
              );
            }
            router.push(
              `/students?imported=${created}&updated=${updated}&issues=${allErrors.length}`,
            );
          } catch {
            setPending(false);
            setErrors(allErrors.slice(0, 8));
            setMessage(
              `The upload paused after adding ${created} new student${created === 1 ? "" : "s"}. Stay on this page and click Upload file again. Already-listed names are skipped.`,
            );
          }
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
