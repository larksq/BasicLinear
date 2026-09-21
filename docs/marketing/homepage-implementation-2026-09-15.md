# OpenLinear public homepage

## Result

Implemented a Linear-inspired public homepage in the existing hosted entry. The local application remains on its original entry. Reference: https://linear.app/, inspected in the in-app browser on 2026-09-15.

- Public hosted entry: `/` on the existing Vercel rewrite, or `/hosted.html` in local preview.
- Hosted application: `?app`; invitation, issue, and OAuth deep links continue to enter the application directly.
- Public homepage rendering does not initialize Firebase or require hosted environment variables.
- Missing hosted configuration shows a recoverable unavailable state with a return to the setup guide.
- No deployment, authentication, account creation, or billing changes were performed.

## Content and interactions

Dark, responsive layout with original OpenLinear branding and copy, interactive sample issue list/board/search, workflow instructions, local/online edition explanation, setup command copying, native FAQ disclosures, mobile navigation with Escape and focus return, skip link, focus styles, reduced-motion support, and page metadata.

The issue preview uses explicitly labeled sample data; it does not modify a workspace. The local setup commands match the repository README. The source license is served at `/openlinear-license.txt`.

## Repository URL

There is no Git remote configured in this checkout and no public source URL was supplied. The page therefore links to the bundled AGPL license and states that the repository link is coming soon. Set `VITE_OPENLINEAR_REPOSITORY_URL` to the actual public GitHub repository URL at web build time to activate the source links. This optional variable is documented in `.env.example`. A rebuild is required.

## Verification

- `npm run build -w @openlinear/web`: passed, including TypeScript and local/hosted Vite builds.
- Homepage routing plus hosted foundation, owner entry, and authentication suites: 20 tests passed across 4 files.
- In-app browser: desktop 1280 × 720 and mobile 390 × 844.
- Verified list/board state, search match, empty state and reset, clipboard contents, FAQ disclosure, mobile menu open/close/Escape, section links, missing-configuration app entry, and return to setup guide.
- No horizontal page overflow at checked sizes; all fragment targets resolve.
- Production preview console: no warnings or errors on homepage or unavailable app-entry flow.
- Live Google sign-in and authenticated workspace actions were not exercised: the local preview has no hosted environment configuration.

Production-build preview: http://127.0.0.1:4178/hosted.html
