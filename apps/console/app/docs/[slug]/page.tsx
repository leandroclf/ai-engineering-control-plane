import Link from "next/link";
import { Card } from "@aicp/ui";
import { docsSource } from "../source";

export function generateStaticParams() { return docsSource.generateParams("slug").map(({ slug }) => ({ slug: slug.at(-1) ?? "index" })); }

export default async function DocsArticle({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = docsSource.getPage([slug]);
  if (!page) return <div className="content"><Card title="Documentation page unavailable"><p className="muted">This documentation page is not present in the generated Fumadocs source.</p><Link className="evidence-link" href="/docs">Return to docs index →</Link></Card></div>;
  const MDXContent = page.data.body;
  return <div className="content"><div className="page-heading"><div><div className="eyebrow">Docs / {slug}</div><h1>{page.data.title}</h1><p className="muted">{page.data.description}</p></div><Link className="button button-secondary" href="/docs">Docs index</Link></div><Card><article className="prose"><MDXContent /></article></Card></div>;
}
