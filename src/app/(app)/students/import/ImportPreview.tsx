"use client";

import { useRef, useState, useTransition } from "react";
import { previewStudentImport, type ImportPreview } from "@/app/actions/import";
import { runStudentImport } from "@/lib/run-student-import";

export function ImportPreviewForm() {
  const returningRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [message, setMessage] = useState("");

  function dataFromInputs() {
    const data = new FormData();
    const returning = returningRef.current?.files?.[0];
    const incoming = newRef.current?.files?.[0];
    if (returning) data.set("returning", returning);
    if (incoming) data.set("newApplication", incoming);
    return data;
  }

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-card p-6">
      <h2 className="font-serif text-2xl">Preview returning and new-application lists</h2>
      <p className="text-sm text-muted">
        Upload both Excel files, review matches, then import. Existing students
        are not overwritten unless you confirm.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          className="action-button-secondary rounded-xl px-4 py-3 font-bold"
          onClick={() => returningRef.current?.click()}
        >
          Returning / retention file
        </button>
        <button
          type="button"
          className="action-button-secondary rounded-xl px-4 py-3 font-bold"
          onClick={() => newRef.current?.click()}
        >
          New-application file
        </button>
        <button
          type="button"
          className="action-button rounded-xl px-4 py-3 font-bold"
          disabled={pending}
          onClick={() => {
            start(async () => {
              const result = await previewStudentImport(dataFromInputs());
              if (!result.ok) {
                setMessage(result.error);
                setPreview(null);
                return;
              }
              setPreview(result.preview);
              setMessage("");
            });
          }}
        >
          {pending ? "Reading…" : "Preview combined list"}
        </button>
      </div>
      <input
        ref={returningRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="sr-only"
      />
      <input
        ref={newRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="sr-only"
      />

      {preview ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Total students", preview.totalStudents],
              ["Unique families (suggested)", preview.uniqueFamilies],
              ["Returning", preview.returning],
              ["New Application", preview.newApplication],
              ["Possible duplicates", preview.duplicates],
              ["Uncertain family matches", preview.uncertain],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-line p-3">
                <div className="text-sm text-muted">{label}</div>
                <div className="font-serif text-2xl">{value}</div>
              </div>
            ))}
          </div>
          {preview.existingConflicts ? (
            <p className="rounded-xl bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-900">
              {preview.existingConflicts} students already exist. They will be
              skipped unless you confirm overwrite.
            </p>
          ) : null}
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
            />
            Update existing students (overwrite confirmed)
          </label>
          <div className="max-h-80 overflow-auto rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-card text-muted">
                <tr>
                  <th className="px-3 py-2">Student</th>
                  <th>Source</th>
                  <th>Parent / phone</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 80).map((row, index) => (
                  <tr key={`${row.studentId}-${index}`} className="border-t border-line">
                    <td className="px-3 py-2">
                      {row.firstName} {row.lastName}
                      <div className="text-xs text-muted">
                        {row.grade} · {row.studentId}
                      </div>
                    </td>
                    <td>
                      {row.enrollmentSource === "NEW_APPLICATION"
                        ? "New Application"
                        : "Returning"}
                    </td>
                    <td>
                      {row.parentName}
                      <div className="text-xs text-muted">{row.parentPhone}</div>
                    </td>
                    <td>
                      {row.duplicate ? <div>Duplicate: {row.duplicateOf}</div> : null}
                      {row.siblingHint ? <div>{row.siblingHint}</div> : null}
                      {row.uncertain ? (
                        <div className="font-semibold text-orange">
                          {row.uncertainNote}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="action-button rounded-xl px-5 py-3 font-bold"
            disabled={pending}
            onClick={() => {
              start(async () => {
                const files = [
                  [returningRef.current?.files?.[0], "RETURNING"],
                  [newRef.current?.files?.[0], "NEW_APPLICATION"],
                ] as const;
                let created = 0;
                let updated = 0;
                const errors: string[] = [];
                for (const [file, source] of files) {
                  if (!file) continue;
                  const result = await runStudentImport({
                    file,
                    overwrite,
                    enrollmentSource: source,
                  });
                  if (!result.ok) {
                    errors.push(result.error || "Import failed.");
                    created += result.progress.created;
                    updated += result.progress.updated;
                    continue;
                  }
                  created += result.created;
                  updated += result.updated;
                  errors.push(...result.errors);
                }
                setMessage(
                  `Imported ${created} new students and updated ${updated}. ${errors.length ? `${errors.length} rows need review.` : ""}`,
                );
              });
            }}
          >
            Import previewed files
          </button>
        </div>
      ) : null}
      {message ? <p className="text-sm font-semibold">{message}</p> : null}
    </div>
  );
}
