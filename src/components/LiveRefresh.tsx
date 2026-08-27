"use client";

import { snapshotClockLabel } from "@/lib/policy";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LiveRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return (
    <p className="text-xs text-muted">
      Live board · refreshes every {seconds} seconds so a parent call after{" "}
      {snapshotClockLabel()} still reaches this screen.
    </p>
  );
}
