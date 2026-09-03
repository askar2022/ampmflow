"use client";

import { importStudents } from "@/app/actions/import";

export type ImportProgress = {
  processed: number;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  excludedNotReturning: number;
  rosterStudents: number;
  errors: string[];
};

async function oneBatch(
  file: File,
  batchStart: number,
  overwrite: boolean,
  enrollmentSource: "RETURNING" | "NEW_APPLICATION",
) {
  const data = new FormData();
  data.set("file", file);
  data.set("enrollmentSource", enrollmentSource);
  data.set("batchStart", String(batchStart));
  if (overwrite) data.set("overwrite", "on");
  return importStudents(data);
}

export async function runStudentImport(options: {
  file: File;
  overwrite?: boolean;
  enrollmentSource?: "RETURNING" | "NEW_APPLICATION";
  onProgress?: (progress: ImportProgress) => void;
}): Promise<ImportProgress & { ok: true } | { ok: false; error: string; progress: ImportProgress }> {
  const overwrite = Boolean(options.overwrite);
  const enrollmentSource = options.enrollmentSource || "RETURNING";
  const progress: ImportProgress = {
    processed: 0,
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    excludedNotReturning: 0,
    rosterStudents: 0,
    errors: [],
  };

  let next = 0;
  let done = false;
  while (!done) {
    let result: Awaited<ReturnType<typeof importStudents>> | null = null;
    let lastError = "";
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        result = await oneBatch(options.file, next, overwrite, enrollmentSource);
        if (result?.ok) break;
        lastError = result && "error" in result ? result.error || "Import failed." : "Import failed.";
      } catch {
        lastError = "The server timed out on this group.";
        result = null;
      }
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
      }
    }
    if (!result?.ok) {
      return {
        ok: false,
        error: lastError || "Import failed.",
        progress,
      };
    }
    progress.created += result.created ?? 0;
    progress.updated += result.updated ?? 0;
    progress.skipped += result.skipped ?? 0;
    progress.excludedNotReturning += result.excludedNotReturning ?? 0;
    progress.rosterStudents = result.rosterStudents ?? progress.rosterStudents;
    progress.total = result.sourceStudents || progress.total;
    progress.errors.push(...(result.errors || []));
    next = result.next ?? next + 6;
    progress.processed = next;
    done = Boolean(result.done);
    options.onProgress?.(progress);
  }

  return { ok: true, ...progress };
}
