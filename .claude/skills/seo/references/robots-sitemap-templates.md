# robots.txt and sitemap.xml templates

## robots.txt

Minimal, permissive default — adapt `Disallow` rules to the project's actual
private/non-indexable paths (admin panels, checkout, API routes, etc.).

```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /*?*session=

Sitemap: https://example.com/sitemap.xml
```

Notes:
- `Disallow` blocks crawling, it does not remove already-indexed pages from
  results (use `noindex` meta tag for that, on pages crawlers can still
  reach).
- Don't block CSS/JS assets crawlers need to render the page — that can hurt
  mobile-friendliness/rendering evaluation.
- One `robots.txt` per (sub)domain, at the root (`/robots.txt`).

## sitemap.xml

For a small/medium site, a single static file is enough:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2026-01-01</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/about</loc>
    <lastmod>2026-01-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>
```

Rules:
- URLs must be absolute, use the canonical scheme/domain, and match a real
  200-status, indexable route.
- Don't list `noindex`ed or redirecting URLs.
- For a large or frequently-changing site, generate this at build time (or
  serve it dynamically) instead of hand-maintaining it — pick whichever
  approach the project's existing tooling supports (e.g., a framework's
  built-in sitemap generator) rather than adding a bespoke one.
- If the site has more than ~50,000 URLs, split into multiple sitemap files
  referenced from a sitemap index file.
