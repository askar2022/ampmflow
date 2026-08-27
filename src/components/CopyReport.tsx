"use client";

import { useState } from "react";

export function CopyReport({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded-xl border border-line bg-card px-4 py-2 text-sm font-semibold"
    >
      {copied ? "Copied" : "Copy for leadership"}
    </button>
  );
}
