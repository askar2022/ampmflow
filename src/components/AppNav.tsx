"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function AppNav({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Warm every nav target while idle so clicks hit a cached RSC payload.
  useEffect(() => {
    for (const item of links) {
      if (item.href !== pathname) router.prefetch(item.href);
    }
  }, [links, pathname, router]);

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
            prefetch
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
