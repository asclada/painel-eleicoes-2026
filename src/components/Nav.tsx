"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Pesquisas" },
  { href: "/previsoes", label: "Previsões" },
  { href: "/apuracao", label: "Apuração ao vivo", live: true },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 text-sm" aria-label="Principal">
      {ITEMS.map((it) => {
        const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 transition-colors ${
              active ? "bg-[#243059] text-white" : "text-muted hover:bg-[#18214a] hover:text-white"
            }`}
          >
            {it.live && <span className="live-dot inline-block h-2 w-2 rounded-full bg-[#f87171]" aria-hidden />}
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
