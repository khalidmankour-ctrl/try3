---
name: seo
description: Search engine optimization work for websites and web apps — technical SEO audits, meta tags, sitemap.xml/robots.txt, structured data (JSON-LD schema), Core Web Vitals, and on-page content optimization. Use when the user asks to improve SEO, rank better in search, add meta/Open Graph tags, generate a sitemap or robots.txt, add schema markup, fix crawlability/indexing issues, or review a page/site for search-engine readiness.
---

# SEO

Helps audit and improve a site's or app's search-engine optimization: technical
crawlability, on-page signals, structured data, and content quality. Works on
any web project (static site, SPA, or server-rendered app) regardless of
framework.

## Workflow

1. **Scope the request.** Is this a full audit of an existing site, or adding
   SEO foundations to a new page/app? Skim the codebase for what already
   exists (`<head>` tags, `sitemap.xml`, `robots.txt`, structured data) before
   proposing changes — don't duplicate or clobber existing setup.

2. **Technical SEO** — see `references/technical-checklist.md`. Covers
   crawlability, `robots.txt`, `sitemap.xml`, canonical URLs, HTTPS, mobile
   viewport, redirect chains, and Core Web Vitals. Templates for
   `robots.txt` and `sitemap.xml` are in `references/robots-sitemap-templates.md`.

3. **On-page SEO** — see `references/on-page-checklist.md`. Covers title
   tags, meta descriptions, heading hierarchy, image `alt` text, internal
   linking, and URL structure. A ready-to-adapt `<head>` snippet (title, meta
   description, canonical, Open Graph, Twitter Card) is in
   `references/meta-tags-template.html`.

4. **Structured data** — add JSON-LD schema matching the page's actual
   content type (Organization, Product, Article, BreadcrumbList, FAQPage,
   etc.). Examples for common types are in
   `references/structured-data-templates.md`. Never emit schema fields for
   data the page doesn't actually contain (e.g., fake `aggregateRating`) —
   that violates Google's structured data guidelines and risks a manual
   penalty.

5. **Content quality** — for pages with authored copy, check: one clear H1
   per page, primary keyword in the title/H1/first paragraph without
   stuffing, descriptive (non-generic) link text, and alt text that describes
   the image rather than repeating the filename.

6. **Verify before finishing:**
   - Validate JSON-LD with a schema checker (structure only — no live fetch
     needed if you check it against the templates' shape).
   - Confirm `sitemap.xml` URLs are absolute, use the canonical domain, and
     match what's actually deployed/routable.
   - Confirm `robots.txt` doesn't accidentally disallow pages you want
     indexed (a common regression when copy-pasting from a staging config).
   - If a build/dev server is available, load the page and check the
     rendered `<head>` (not just the source template) — client-side
     rendering can strip tags that were only set on the server.

## Notes

- Don't invent business facts (ratings, prices, addresses) to fill out
  templates — leave placeholders clearly marked and ask the user for real
  values, or omit optional fields entirely.
- Keep meta descriptions under ~155 characters and title tags under ~60
  characters so they aren't truncated in search results.
- For SPAs, check whether the framework needs SSR/prerendering for crawlers
  to see content-bearing HTML; note this as a finding rather than silently
  assuming client-side rendering is sufficient.
