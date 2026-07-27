# P003 Human QA

> Status: Passed by explicit human attestation on 2026-07-27.

## Environment

- Operating system: Not supplied with the human attestation.
- Browser/version: Not supplied with the human attestation.
- Application boundary:
  `d277584c87eb90498060bc9d2279d9abf7292f5a`; application review-fix behavior
  at `5de9490cf80c3cdda286f0565608f415ee75241f`.
- Development identity/tenant: Human attested that Q1-Q10 passed using the
  seeded Northstar role/tenant scenarios from the approved walkthrough; exact
  session sequence was not separately supplied.

## Test Cases

| ID  | Status | Evidence                                                                                                  |
| --- | ------ | --------------------------------------------------------------------------------------------------------- |
| Q1  | Passed | Human attested startup/health plus representative P001 request and P002 sign-in/access/invitation passes. |
| Q2  | Passed | Human attested exact normalized draft terms, rounded server-derived USD cost, and refresh persistence.    |
| Q3  | Passed | Human attested draft recalculation and stale second-browser protection without overwrite.                 |
| Q4  | Passed | Human attested immutable submission, awaiting-approval state, and complete client draft invisibility.     |
| Q5  | Passed | Human attested one durable approval response, retained history, and no automatic in-progress transition.  |
| Q6  | Passed | Human attested required rejection reason plus numbered revision and superseded immutable history.         |
| Q7  | Passed | Human attested required clarification reason, exact state, and revision without P004 comments.            |
| Q8  | Passed | Human attested the complete role/capability matrix and direct suspended/internal/tenant denials.          |
| Q9  | Passed | Human attested one concurrent response outcome/history transition, isolation, exact strings, redaction.   |
| Q10 | Passed | Human attested keyboard-only and narrow-viewport success, validation, conflict, and failure behavior.     |

## QA Decision

- Required QA complete: Yes.
- Human QA acceptance: Granted by explicit statement, “all manual QA tests
  pass,” on 2026-07-27.
- Browser/version, operating-system details, and screenshots were not supplied;
  this limitation is preserved rather than inferred.
- Evidence-record validation initially found only Prettier formatting in this
  expanded QA note; formatting was normalized before the final passing checks.
- Final integration/completion approval: Explicitly granted by the human on
  2026-07-27 for local fast-forward integration to `main`, with no push or
  remote action.
