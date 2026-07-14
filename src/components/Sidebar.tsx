"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Dashboard", icon: "M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" },
  { href: "/leads", label: "Leads", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" },
  { href: "/clients", label: "Clients", icon: "M20 7h-9M14 17H5M17 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6M7 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6" },
  { href: "/freelancers", label: "Freelancers", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" },
  { href: "/accounting", label: "Accounting", icon: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">
          T
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">Tasteology</p>
          <p className="text-xs text-slate-400">& Co · CRM</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {nav.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 text-xs text-slate-400">
        Tasteology &amp; Co
      </div>
    </aside>
  );
}
