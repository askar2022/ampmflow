"use client";

export function CompanyActions({ preview }: { preview: string }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-5 print-sheet">
      <div className="no-print">
        <h2 className="font-serif text-2xl">Copy or print the report</h2>
        <p className="mt-1 text-sm text-muted">
          This prints only the bus-company change report. It does not open the
          Reports page or send email.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white"
          >
            Print report
          </button>
          <a
            href="/print/export?kind=company"
            className="rounded-xl border border-line px-4 py-2 text-sm font-semibold"
          >
            Download Excel
          </a>
        </div>
      </div>
      <pre className="mt-4 overflow-auto rounded-xl bg-paper p-4 text-xs whitespace-pre-wrap">
        {preview}
      </pre>
    </section>
  );
}
