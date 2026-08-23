"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigation } from "../lib/navigation";

const groups = ["Operate", "Governance", "Knowledge", "Verify & learn"] as const;

export function ConsoleNavigation() {
  const pathname = usePathname();
  return <nav aria-label="Primary navigation">{groups.map((group) => <div key={group}><div className="nav-group">{group}</div>{navigation.filter((item) => item.group === group).map((item) => {
    const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
    return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>{item.label}</Link>;
  })}</div>)}</nav>;
}
