# README screenshots

Captured in Chrome on **September 21, 2026**. These images replace the August 24
README captures, including the duplicate overview/milestones image.

| Image | Source | Content |
| --- | --- | --- |
| `online-homepage.jpg` | Live public site | Homepage and its interactive sample workspace |
| `project-overview.jpg` | Current local build | Project properties, progress, overview, and milestone |
| `issue-detail.jpg` | Current local build | Issue list and resizable detail panel |
| `issue-board.jpg` | Current local build | Saved board grouped by status |
| `saved-views.jpg` | Current local build | Saved list and board configurations |
| `issue-detail-mobile.jpg` | Current local build | Expanded properties at a mobile viewport (375 × 812 capture) |

The public homepage was captured at <https://openlinear.qiaosun.me/>.
Application screenshots use only the synthetic `team-route` fixture in
[`scripts/serve-visual-fixture.mjs`](../../scripts/serve-visual-fixture.mjs),
served from the current `apps/web/dist` build. They depict the **local edition**,
not a signed-in production account. Dates and names inside the fixture are
sample content and do not indicate the screenshot date.

## Recapture

```sh
npm ci
npm run build
npm run visual:fixture -- --port 4176
```

Open `http://127.0.0.1:4176/?fixture=team-route` in Chrome. Use **Projects** to
open the overview and project issues, open **QA-1** for its detail panel, and
use **Views → Engineering review** for the board. At the mobile viewport,
expand **Properties** in the issue detail and scroll to the inspector.

Desktop captures use the normal browser viewport. The board and saved-views
captures omit unused space below the content. The mobile viewport override is
reset after capture. Images are direct browser captures, without redaction,
compositing, or generated UI.

[`capture-manifest.json`](capture-manifest.json) records image dimensions and
hashes, the local built-output digest, fixture digest, and capture date. The
local build came from the modified working tree; the base Git commit alone
does not identify those changes. Accountable asset review remains part of the
release process.
