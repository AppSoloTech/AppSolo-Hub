# P005 Human QA

> Status: Passed by explicit human attestation on 2026-07-27.

## Environment

- Operating system: Not supplied with the human attestation.
- Browser/version: Not supplied with the human attestation.
- Application boundary: `f295ff4bf221d73ad0cbabf4e9696cf7592265b9`.
- Development identity/tenant: Human attested that Q1-Q10 passed using the
  seeded Northstar role/tenant scenarios from the approved walkthrough; exact
  session sequence was not separately supplied.

## Pre-QA UI Follow-Up

- Human-requested persistent dark mode was added in
  `8a734cc36b1457051021b2277d768ff24c328940` after independent P005 review and
  before human QA.
- Automated checks passed: lint, strict typecheck, 38/38 web tests, all
  workspace production builds, and 6/6 isolated Playwright tests.
- Pre-QA startup correction
  `f295ff4bf221d73ad0cbabf4e9696cf7592265b9` pins Vite strictly to port 5173,
  preventing a duplicate startup from silently moving to the CORS-disallowed
  port 5174. The duplicate process was stopped, the normal 4000/5173 stack was
  preserved, and direct `developer@appsolo.test` sign-in returned `200`.
- Before Q1, select **Dark mode** in the sidebar, reload the page, and confirm
  the dark preference remains applied. This visual check is supplemental and
  does not replace Q1–Q10.

## Test Cases

| ID  | Status | Evidence                                                                                                                   |
| --- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Passed | Human attested normal startup/health and representative P001–P004 regression behavior pass.                                |
| Q2  | Passed | Human attested authorized start, refresh persistence, one history event, and repeat/stale/unauthorized denial pass.        |
| Q3  | Passed | Human attested internal-role time creation, totals, pagination, allowed void, replacement, and immutable attribution pass. |
| Q4  | Passed | Human attested own/all void authority and complete client-role time redaction without existence signals pass.              |
| Q5  | Passed | Human attested handoff, client change request, return to work, version 2, and immutable version 1/history pass.            |
| Q6  | Passed | Human attested client-admin completion, terminal behavior, persisted history, and read-only controls pass.                 |
| Q7  | Passed | Human attested authorized cancellation, role denials, atomic history, and terminal-state no-reopen behavior pass.          |
| Q8  | Passed | Human attested tenant/lifecycle/identifier/stale/concurrency denials and no partial durable state pass.                    |
| Q9  | Passed | Human attested stable mixed-history pagination, completeness, and client filtering without visibility oracles pass.        |
| Q10 | Passed | Human attested keyboard, narrow-viewport, feedback, validation, conflict, failure recovery, focus, and wrapping pass.      |

## QA Decision

- Required QA complete: Yes.
- Human QA acceptance: Granted by the explicit statement, “the manual QA is
  done and it passes,” on 2026-07-27.
- No additional command transcript, screenshots, browser/version,
  operating-system details, or exact session sequence were supplied; those
  limitations are preserved rather than inferred.
- Final integration/completion approval: Explicitly granted by the human on
  2026-07-27 for local integration to `main`.
