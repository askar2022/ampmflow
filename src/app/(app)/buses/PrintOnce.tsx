"use client";

import { useEffect } from "react";

export function PrintOnce() {
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white"
    >
      Print for driver
    </button>
  );
}
