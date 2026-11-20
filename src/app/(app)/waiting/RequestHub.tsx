"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const CHOICES = [
  {
    href: "/waiting/route",
    title: "New route request",
    blurb: "Student is new to the school and needs a bus or van.",
  },
  {
    href: "/waiting/daycare",
    title: "Daycare add or change",
    blurb: "Send an existing student to daycare, or update daycare details.",
  },
  {
    href: "/waiting/address",
    title: "New address",
    blurb: "Temporary or permanent drop-off at a different address.",
  },
] as const;

export function RequestHub() {
  const router = useRouter();

  useEffect(() => {
    for (const choice of CHOICES) {
      router.prefetch(choice.href);
    }
  }, [router]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl text-navy">Submit new request</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Choose one request type. Front Desk stays for finding students and
          viewing their plan.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {CHOICES.map((choice) => (
          <Link
            key={choice.href}
            href={choice.href}
            prefetch
            className="rounded-2xl border border-line bg-card p-5 shadow-sm transition hover:border-navy/30 hover:shadow-md"
          >
            <h2 className="font-serif text-2xl text-navy">{choice.title}</h2>
            <p className="mt-2 text-sm text-muted">{choice.blurb}</p>
            <span className="mt-4 inline-block text-sm font-semibold text-navy">
              Continue →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
