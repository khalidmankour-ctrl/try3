# Technical SEO checklist

Work through these in order — earlier items block search engines from even
reaching later ones.

## Crawlability & indexing

- [ ] `robots.txt` exists at the domain root and doesn't block pages meant to
      be indexed (check `Disallow` rules against real routes).
- [ ] `sitemap.xml` exists, is referenced in `robots.txt` (`Sitemap:` line),
      and lists only canonical, indexable, 200-status URLs.
- [ ] No orphan pages — every indexable page is reachable via internal links
      from the sitemap or nav, not just the XML sitemap.
- [ ] Canonical tag (`<link rel="canonical">`) on every page, pointing to the
      preferred URL (no duplicate content across `?query` params, trailing
      slashes, or `www`/non-`www` variants).
- [ ] No accidental `noindex` meta tags or `X-Robots-Tag` headers left over
      from a staging config.
- [ ] Redirect chains are single-hop (A→B, not A→B→C); use 301 for permanent
      moves.

## Site structure

- [ ] HTTPS enforced, HTTP redirects to HTTPS.
- [ ] One canonical domain (pick `www` or non-`www`, redirect the other).
- [ ] URLs are readable and stable (`/products/blue-jacket`, not
      `/p?id=48213`) — don't change existing indexed URLs without a redirect.
- [ ] `hreflang` tags if the site serves multiple languages/regions.
- [ ] 404s return a real 404 status (not 200 with a "not found" page body).

## Performance (Core Web Vitals)

- [ ] Largest Contentful Paint (LCP) — largest above-the-fold image/text
      renders quickly; preload the LCP image, avoid render-blocking resources.
- [ ] Cumulative Layout Shift (CLS) — images/embeds have explicit
      width/height or `aspect-ratio` so layout doesn't jump as they load.
- [ ] Interaction to Next Paint (INP) — avoid long JS tasks blocking the main
      thread on first interaction.
- [ ] Images compressed and served in modern formats (WebP/AVIF) with
      responsive `srcset` where useful.
- [ ] Mobile viewport meta tag present: `<meta name="viewport"
      content="width=device-width, initial-scale=1">`.

## Rendering

- [ ] For SPAs/client-rendered apps: verify meaningful content is present in
      the initial HTML response (view source, not just the rendered DOM), or
      that the crawler-facing render path uses SSR/prerendering/dynamic
      rendering.
- [ ] Structured data is present in the HTML that gets crawled, not injected
      only after a client-side data fetch with no fallback.
