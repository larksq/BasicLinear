# Dedicated OpenLinear app login

## Content and design

The unauthenticated `?app` route is a focused login/registration screen. Google is the existing supported identity provider; a single action handles returning and new users. No email/password form or separate registration flow is invented. The page explains automatic account creation, secure sign-in, and the separation of local workspace data. Pricing and feature marketing were removed from this entry screen. The public homepage remains available separately.

Image2 generated `login-image2-reference.png`; a second extraction produced the text-free sculpture used at `apps/web/public/images/login-sculpture.jpg` (255 KB). All typography, links, buttons, feedback, and branding are rendered as HTML/SVG. Desktop follows the generated split layout. Mobile removes the decorative panel and prioritizes authentication.

## Implementation

- `hosted-login.tsx` and `.css`: presentation and accessible loading/error/retry states.
- `hosted-app.tsx`: existing OwnerEntry authentication passes state/callbacks into the new presentation. Existing restored sessions, workspace bootstrap, invitations and OAuth flows retained.
- `hosted-main.tsx` / `hosted.css`: neutral dark loading surface, avoiding a light flash before authentication loads.
- Home links preserve the current pathname for both `/` deployments and `/hosted.html` local preview.

## Verification

- TypeScript and local/hosted Vite production builds passed.
- 32 tests across 7 suites passed: login states, entry routing, saved-session homepage isolation, hosted foundation, owner entry, Firebase authentication and environment isolation.
- Browser checked desktop 1440×1024, mobile 390×844, narrow 320×700. No horizontal DOM overflow at 320px; primary action remains 52px tall.
- Clicked Google action: disabled pending state and subsequent accessible retry error verified. Local provider sign-in did not complete; no account was created or workspace data changed.
- Back to home and Open app navigation verified. Browser reported no console errors.

This change is implemented locally and has not been deployed to either remote environment.

## Release update — shared logo and deployment

The earlier local-only status is superseded. All brand placements now use `brand-mark.tsx`, backed by the existing `/favicon.svg` two-bar artwork. Homepage, login, hosted app, hosted workspace and local app consume the shared component. Dark surfaces retain a white treatment of the same geometry.

Both hosted environments deployed successfully; IDs and readiness timestamps are in `login-release-2026-09-18.json`. Deployments reuse each environment’s previous source snapshot with only the reviewed frontend files overlaid, preserving backend/configuration. The local-app mark was also updated in this workspace. Local and hosted builds passed; 32 targeted tests passed. Browser verification confirmed the new login/trust card, both logo assets loaded, correct development banner isolation, and return-to-home navigation on both public domains. Successful Google authentication was not repeated in this release.
