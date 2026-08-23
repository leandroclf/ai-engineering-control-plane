"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { navigation } from "../lib/navigation";

const commands = [...navigation, { label: "Authority documentation", href: "/docs/authority", group: "Documentation", keywords: ["harness", "authority"] }, { label: "First Governed Run", href: "/learn/first-run", group: "Academy", keywords: ["tutorial", "onboarding"] }];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const results = useMemo(() => commands.filter((command) => `${command.label} ${command.keywords.join(" ")}`.toLowerCase().includes(query.toLowerCase().trim())), [query]);
  const close = () => { setOpen(false); setQuery(""); trigger.current?.focus(); };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); trigger.current = document.activeElement as HTMLElement; setOpen((value) => !value); } if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => { if (open) { setActive(0); input.current?.focus(); } }, [open]);
  if (!open) return null;
  return <div className="command-backdrop" role="presentation" onClick={close}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Command and search palette" onClick={(event) => event.stopPropagation()}><div className="eyebrow">Command & search</div><h2>What do you want to inspect?</h2><input ref={input} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(value + 1, results.length - 1)); } if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(value - 1, 0)); } if (event.key === "Enter" && results[active]) window.location.assign(results[active].href); }} placeholder="Search navigation, docs and Academy" aria-label="Search commands" /><nav className="command-list" aria-label="Command results">{results.length ? results.map((command, index) => <Link href={command.href} key={command.href} data-active={index === active || undefined} onClick={close}><span>{command.label}<small>{command.group}</small></span><span aria-hidden="true">↵</span></Link>) : <p className="muted">No matching routes, documentation or Academy modules.</p>}</nav></section></div>;
}

export function CommandTrigger() {
  return <button className="button button-ghost" type="button" onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}>⌘K Search</button>;
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { const stored = window.localStorage.getItem("aicp-theme"); const value = stored === "dark"; setDark(value); document.documentElement.dataset.theme = value ? "dark" : "light"; }, []);
  const toggle = () => { const value = !dark; setDark(value); document.documentElement.dataset.theme = value ? "dark" : "light"; window.localStorage.setItem("aicp-theme", value ? "dark" : "light"); };
  return <button className="button button-ghost" type="button" onClick={toggle} aria-label={`Switch to ${dark ? "light" : "dark"} theme`}>{dark ? "☼ Light" : "◐ Dark"}</button>;
}

export function LocaleSwitcher({ currentLocale }: { currentLocale: string }) {
  const change = (value: string) => { document.documentElement.lang = value; document.documentElement.dataset.locale = value; window.localStorage.setItem("aicp-locale", value); document.cookie = `aicp-locale=${value}; Path=/; SameSite=Lax`; window.location.reload(); };
  return <label className="locale-switcher"><span className="sr-only">Locale</span><select aria-label="Locale" value={currentLocale} onChange={(event) => change(event.target.value)}><option value="en">EN</option><option value="pt-PT">PT-PT</option><option value="pt-BR">PT-BR</option></select></label>;
}
