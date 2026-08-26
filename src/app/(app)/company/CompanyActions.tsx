"use client";

import { useState, useTransition } from "react";
import { emailCompanyReport } from "@/app/actions/email";

export function CompanyActions({ preview }: { preview: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <h2 className="font-serif text-2xl">Email the bus company</h2>
      <p className="mt-1 text-sm text-muted">
        If SMTP is not configured, copy the report below or print it from Print /
        Email.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await emailCompanyReport();
              setMessage(
                result.ok
                  ? "Report emailed."
                  : result.error || "Could not send email.",
              );
            })
          }
          className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white"
        >
          {pending ? "Sending…" : "Email change report"}
        </button>
        <a
          href="/print?kind=company"
          className="rounded-xl border border-line px-4 py-2 text-sm font-semibold"
        >
          Print report
        </a>
      </div>
      {message ? <p className="mt-2 text-sm">{message}</p> : null}
      <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-paper p-4 text-xs">
        {preview}
      </pre>
    </section>
  );
}
