"use client";

import { useReportWebVitals } from "next/web-vitals";

const allowed = new Set(["TTFB", "FCP", "LCP", "CLS", "INP"]);

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (!allowed.has(metric.name)) return;
    void fetch("/api/telemetry", { method: "POST", headers: { "content-type": "application/json" }, keepalive: true, body: JSON.stringify({ type: "web-vital", name: metric.name, value: Math.round(metric.value), rating: metric.rating, route: window.location.pathname }) });
  });
  return null;
}
