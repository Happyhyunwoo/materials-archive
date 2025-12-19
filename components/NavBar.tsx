"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/people", label: "People" },
  { href: "/publications", label: "Publications" },
  { href: "/projects", label: "Projects" },
  { href: "/news", label: "News" },
  { href: "/resources", label: "Resources" },
] as const;

export default function NavBar() {
  const pathname = usePathname();

  return (
    <div className="border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-semibold text-gray-900">
          Yonsei HW Lab
        </Link>

        <nav className="flex flex-wrap items-center gap-2">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cx(
                  "rounded-xl border bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50",
                  active && "border-gray-900 ring-2 ring-gray-200"
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

