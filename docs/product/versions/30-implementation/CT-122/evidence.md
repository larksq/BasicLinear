# CT-122 Implementation Evidence

Commit `7becafff8248b03711d48c8354fbdedcf263a2bf` raises selected issue-row metadata to the primary semantic text color while retaining the overdue danger-color exception.

On the exact Light candidate, selected OL-12 metadata computes to `rgb(32, 33, 36)` over `color(srgb 0.914824 0.928824 0.960471)`, a 13.71:1 ratio against the 4.5:1 requirement. Contextual issue states in System, Light, and Dark have zero axe violations and zero incomplete results. All regression, typecheck, release-audit, and build checks pass.

Raw evidence is sealed mode 0600 at `.control-tower/evidence/CT-118-123/implementation-e1299af.json`, SHA-256 `3e2a81e8c0c03ad756af56591d5dedf10c772a47696de7ba5235693db38082a9`. CT-122 remains In Progress pending distinct application review.
