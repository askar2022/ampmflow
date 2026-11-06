import Link from "next/link";

export function LegalDoc({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <p className="text-sm">
        <Link href="/" className="font-semibold text-teal hover:text-teal-deep">
          ← AMPM Flow
        </Link>
      </p>
      <h1 className="mt-4 font-serif text-4xl text-navy">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated: {updated}</p>
      <div className="prose-legal mt-6 space-y-4 text-sm leading-6 text-navy">
        {children}
      </div>
      <p className="mt-8 text-sm text-muted">
        Questions?{" "}
        <a
          href="mailto:askar@automationllc.org"
          className="font-semibold text-teal hover:text-teal-deep"
        >
          askar@automationllc.org
        </a>
      </p>
    </div>
  );
}
