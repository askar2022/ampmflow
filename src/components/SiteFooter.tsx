import Link from "next/link";
import { getSession } from "@/lib/auth";

export async function SiteFooter() {
  const session = await getSession().catch(() => null);

  return (
    <footer className="no-print px-4 py-6 text-center text-xs leading-5 text-[#9aa1aa]">
      <p>© 2026 Dr. Askar. All rights reserved.</p>
      <p>Designed and developed by Powered by Automation, LLC.</p>
      {session ? (
        <p className="mt-2">
          <Link
            href="/privacy"
            className="font-medium text-[#7a828c] underline-offset-2 hover:text-navy hover:underline"
          >
            Data Privacy
          </Link>
          <span className="mx-2" aria-hidden="true">
            ·
          </span>
          <Link
            href="/terms"
            className="font-medium text-[#7a828c] underline-offset-2 hover:text-navy hover:underline"
          >
            Terms and Conditions
          </Link>
        </p>
      ) : null}
    </footer>
  );
}
