# CT-142 Testing Session

Captured: 2026-08-26T03:38:56Z

This Testing session exercises only the maintainer-authorized nonsecurity part of I-210/P-T210. It uses the project-local Control Tower v0.8 API, local provider fixtures, selected positive-path tests, the dual local/hosted build, and a local browser observation. It does not use the Control Tower interface or Linear.

The integrated journey covers Google owner bootstrap semantics, the exact 30-day Pro trial, invitation acceptance, two active seats, assignment, member task updates, comments, the $2 monthly per-seat fixture, paid activation, and Free fallback. Additional selected tests cover the $12 annual option, REST/OpenAPI, personal tokens, canonical export, MCP/OAuth/skill happy paths, accessibility-supporting UI behavior, operational configuration, and excluded product scope.

Per the maintainer directive in `maintainer-security-skip.json`, this session did not run security, adversarial, hostile-input, tenant-attack, rules-emulator, replay/enumeration, or vulnerability checks. R-204's integrated tenant-security validation, R-219, and the security portion of P-T210 therefore remain unqualified. Outcomes O-201 through O-204 remain baseline-needed. No provider, deployment, public release, legal, privacy, or security claim is made.
