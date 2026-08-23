import type { Metadata } from "next";
import "./globals.css";
import { CommandPalette, CommandTrigger, LocaleSwitcher, ThemeToggle } from "./components/command-palette";
import { ConsoleNavigation } from "./components/navigation";
import { WebVitalsReporter } from "./components/web-vitals";
import { getLocale, getTranslations } from "next-intl/server";

export const metadata: Metadata = { title: "AICP Console", description: "Governed execution, evidence, context, memory and release readiness." };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale(); const t = await getTranslations("Console");
  return <html lang={locale}><body><WebVitalsReporter /><div className="app-shell"><aside className="sidebar"><a className="brand" href="/">AICP <small>Human Control Plane</small></a><ConsoleNavigation /><div className="muted" style={{ marginTop: "auto", color: "#8fa2b8" }}>{t("demo")}<br />No provider keys required</div></aside><div className="main"><header className="topbar"><div className="muted">Governed engineering workspace</div><div className="topbar-actions"><CommandTrigger /><LocaleSwitcher currentLocale={locale} /><ThemeToggle /><span className="status status-success"><span className="status-dot" />{t("ready")}</span></div></header><main>{children}</main></div></div><CommandPalette /></body></html>;
}
