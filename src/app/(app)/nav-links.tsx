"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/plan", label: "Plan", icon: "⏱️" },
  { href: "/events", label: "Live", icon: "📍" },
  { href: "/chat", label: "Buddy", icon: "💬" },
  { href: "/friends", label: "Friends", icon: "👥" },
  { href: "/me", label: "Me", icon: "🙂" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 backdrop-blur">
      <ul className="mx-auto flex max-w-3xl justify-around px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {LINKS.map((l) => {
          const active = path === l.href || path.startsWith(l.href + "/");
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`flex flex-col items-center rounded-lg px-3 py-1 text-xs ${active ? "font-semibold text-accent" : "text-muted"}`}
                aria-current={active ? "page" : undefined}
              >
                <span className="text-lg leading-6" aria-hidden>
                  {l.icon}
                </span>
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
