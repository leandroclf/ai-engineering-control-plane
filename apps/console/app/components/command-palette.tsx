"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const commands = [["Overview", "/"], ["Runs", "/runs"], ["New run", "/runs/new"], ["Architecture", "/architecture"], ["Release certification", "/release"], ["Documentation", "/docs"]];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen((value) => !value); } if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  if (!open) return null;
  return <div className="command-backdrop" role="presentation" onClick={() => setOpen(false)}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Console command palette" onClick={(event) => event.stopPropagation()}><div className="eyebrow">Navigate</div><h2>What do you want to inspect?</h2><nav className="command-list">{commands.map(([label, href]) => <Link href={href} key={href} onClick={() => setOpen(false)}>{label}<span aria-hidden="true">↵</span></Link>)}</nav></section></div>;
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

export function LocaleSwitcher() {
  const change = (value: string) => { document.documentElement.lang = value; window.localStorage.setItem("aicp-locale", value); };
  return <label className="locale-switcher"><span className="sr-only">Locale</span><select aria-label="Locale" defaultValue="en" onChange={(event) => change(event.target.value)}><option value="en">EN</option><option value="pt-BR">PT-BR</option></select></label>;
}
