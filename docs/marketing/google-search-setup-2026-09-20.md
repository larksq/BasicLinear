# Google Search setup and indexing repair — 2026-09-20

Production: <https://basiclinear.qiaosun.me/>. Checks performed on September 20, 2026, Asia/Shanghai.

## Diagnosis

Google Search Console's verified `sc-domain:qiaosun.me` property already covers the BasicLinear subdomain. No additional ownership token or permission grant was needed.

Before the repair, URL Inspection reported **Page is not indexed: Blocked by robots.txt**. Its last recorded crawl was September 18, 2026, 16:03:32, by Googlebot smartphone. It reported no referring sitemap and no user-declared canonical URL.

Direct HTTP checks confirmed:

| Check | Before | After |
| --- | --- | --- |
| Homepage HTTP status | 200 | 200 |
| Homepage `X-Robots-Tag` | `noindex, nofollow, noarchive` | Absent on the canonical public homepage |
| `robots.txt` | `Disallow: /` | Homepage/assets allowed; API, OAuth, and MCP crawl exclusions retained |
| `sitemap.xml` | 404 | 200, XML, one canonical public URL |
| Initial HTML body | Empty React root | Complete homepage content rendered from the existing React component |
| Canonical URL | Missing | `https://basiclinear.qiaosun.me/` |

The global crawler exclusion was inherited from the hosted workspace deployment. It also covered the public homepage. Google documents that blocked URLs cannot be rendered and that a `noindex` response prevents indexing. See [Google's JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

## Implemented behavior

- `scripts/prerender-homepage.mjs` creates `homepage.html`, production `robots.txt`, and `sitemap.xml` after the hosted Vite build. It renders the same `Homepage` component used by browsers, adds a canonical link, Open Graph identity, and `WebSite` JSON-LD, and preserves the existing browser assets and analytics script.
- Production `/` serves the public page. `?app`, `?oauth_request`, and `?oauth_workspace` still serve the private hosted shell with HTTP and HTML `noindex` directives. `/hosted.html`, API/OAuth/MCP/discovery routes, and alternate deployment hosts remain excluded from indexing.
- `basiclinear-search-policy.js` adds `noindex` before the app runs for private fragment links and noncanonical hosts. Fragments are never sent to the HTTP server.
- `/homepage.html` permanently redirects to `/`. Unknown URLs still return 404.
- Development/local builds remove stale public search artifacts and restore the default disallow-all robots file. The existing development deployment continues to send global `noindex`; it was not redeployed.
- The production routing configuration is `ops/hosted/vercel-production.json`. The root `vercel.json` now uses the production-safe routing default; development deployments explicitly use `ops/hosted/vercel-development.json`.

## Deployment

- Previous production: `dpl_B7ym3KSn18tRtwExzMXFxVGHysGP`.
- Repaired production: `dpl_J64kzjTMGtoqv5YEjDioxTHj7V7m`, READY, bound to `basiclinear.qiaosun.me` and the existing production aliases.
- [Vercel deployment](https://vercel.com/qsuns-projects/basiclinear-online/dpl_J64kzjTMGtoqv5YEjDioxTHj7V7m).
- Deployment reused 541 source files by their existing production SHA and overlaid six SEO-related files: hosted HTML, the web package build commands, the search policy script, the prerender script, the production routing manifest, and its deployment-root `vercel.json` copy. Other local changes were not published. No backend deployment or business-data mutation was made.
- The live main JavaScript and stylesheet still use the previous production asset names: `hosted-ezb2-PNL.js` and `hosted-D4w07Z3U.css`.

## Google acceptance

- Live URL test, September 20 at 08:50: **URL is available to Google** and **Page can be indexed**.
- Request Indexing completed: **Indexing requested**; Google confirmed addition to a priority crawl queue.
- Submitted <https://basiclinear.qiaosun.me/sitemap.xml> to the existing domain property. The sitemap table shows **Success**, last read September 20, and **1 discovered page**.
- [Search Console sitemaps](https://search.google.com/search-console/sitemaps?resource_id=sc-domain%3Aqiaosun.me).

This verifies crawlability and completed submission, not appearance in search results or a particular ranking. Google controls subsequent crawling, canonical selection, and indexing; [technical eligibility does not guarantee indexing](https://developers.google.com/search/docs/essentials/technical).

## Validation and repeatable checks

- Hosted production-mode build and web typecheck passed.
- 25 focused tests passed: 2 search tests, 6 analytics privacy tests, and 17 homepage/hosted-environment tests. Search regression tests are included in CI.
- 15 live HTTP checks passed, covering the homepage, Googlebot parity, sitemap, robots, JavaScript/CSS access, private query entries, hosted shell, alternate/development hosts, permanent redirect, and real 404 behavior. A first audit encountered transient TLS resets and an overly strict assumption that the older development deployment had a robots file; the audit now retries only transport failures and verifies development exclusion through its actual `noindex` header.
- Chrome confirmed the homepage preview can switch layouts and the existing signed-in production workspace loads through Open app. QA visit used `utm_source=qa`, `utm_medium=internal`, and `utm_campaign=seo_setup_20260920`.
- Live evidence: `outputs/seo-2026-09-20/live-audit.json`.

Run from the repository root:

```sh
node --test scripts/tests/public-search.test.mjs scripts/tests/analytics-privacy.test.mjs
npm test -- --run apps/web/tests/homepage-entry.test.ts apps/web/tests/homepage-session.test.ts apps/web/tests/hosted-environment.test.ts
node scripts/audit-search-indexing.mjs
```
