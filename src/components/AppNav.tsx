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
          item.href === "/company"
            ? pathname === "/company"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full px-3 text-[14px] font-medium ${
              active
                ? "bg-teal text-white hover:bg-teal"
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
