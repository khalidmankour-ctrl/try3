# Structured data (JSON-LD) templates

Embed as `<script type="application/ld+json">…</script>` in the `<head>` or
`<body>`. Only include a schema type that matches content actually on the
page, and only fill fields with real data — omit optional fields rather than
fabricating values (fake reviews/ratings/prices can trigger a manual
Google penalty).

## Organization (site-wide, e.g. in a global layout)

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "BRAND NAME",
  "url": "https://example.com",
  "logo": "https://example.com/logo.png",
  "sameAs": [
    "https://twitter.com/brandhandle",
    "https://www.linkedin.com/company/brand"
  ]
}
```

## Product

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "PRODUCT NAME",
  "image": ["https://example.com/product.jpg"],
  "description": "PRODUCT DESCRIPTION",
  "brand": { "@type": "Brand", "name": "BRAND NAME" },
  "offers": {
    "@type": "Offer",
    "url": "https://example.com/products/product-slug",
    "priceCurrency": "USD",
    "price": "49.99",
    "availability": "https://schema.org/InStock"
  }
}
```
Only add `aggregateRating`/`review` if the page displays real reviews.

## Article / BlogPosting

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "ARTICLE TITLE",
  "image": ["https://example.com/article-image.jpg"],
  "datePublished": "2026-01-01T08:00:00Z",
  "dateModified": "2026-01-01T08:00:00Z",
  "author": { "@type": "Person", "name": "AUTHOR NAME" },
  "publisher": {
    "@type": "Organization",
    "name": "BRAND NAME",
    "logo": { "@type": "ImageObject", "url": "https://example.com/logo.png" }
  }
}
```

## BreadcrumbList

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://example.com/" },
    { "@type": "ListItem", "position": 2, "name": "Category", "item": "https://example.com/category" },
    { "@type": "ListItem", "position": 3, "name": "Current Page", "item": "https://example.com/category/page" }
  ]
}
```

## FAQPage

Only use on a page that actually renders these Q&As as visible content —
don't add hidden FAQ schema purely to get rich results.

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "QUESTION TEXT",
      "acceptedAnswer": { "@type": "Answer", "text": "ANSWER TEXT" }
    }
  ]
}
```
