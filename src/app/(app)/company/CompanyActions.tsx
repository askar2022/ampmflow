export function CompanyActions({ preview }: { preview: string }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <h2 className="font-serif text-2xl">Copy or print the report</h2>
      <p className="mt-1 text-sm text-muted">
        This is only a printable report. It does not send email or open Outlook.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href="/print?kind=company"
          className="inline-block rounded-xl border border-line px-4 py-2 text-sm font-semibold"
        >
          Open print report
        </a>
        <a
          href="/print/export?kind=company"
          className="inline-block rounded-xl border border-line px-4 py-2 text-sm font-semibold"
        >
          Download Excel
        </a>
      </div>
      <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-paper p-4 text-xs">
        {preview}
      </pre>
    </section>
  );
}
