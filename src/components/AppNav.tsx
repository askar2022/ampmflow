"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppNav({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <>
      {links.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              active
                ? "bg-nav-active text-teal-deep hover:bg-nav-active"
                : "text-white hover:bg-white/10"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
