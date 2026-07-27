# P004 Human QA

> Status: Passed by explicit human attestation on 2026-07-27.

## Environment

- Operating system: Not supplied with the human attestation.
- Browser/version: Not supplied with the human attestation.
- Application boundary:
  `4c328f74a57076fa19f57937ae30867d5fabcbd2`.
- Development identity/tenant: Human attested that Q1-Q10 passed using the
  seeded Northstar role/tenant scenarios from the approved walkthrough; exact
  session sequence was not separately supplied.

## Test Cases

| ID  | Status | Evidence                                                                                                         |
| --- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| Q1  | Passed | Human attested startup/health and representative P001 request, P002 access/invitation, and P003 estimate passes. |
| Q2  | Passed | Human attested the internal composer default, labeled creation, refresh persistence, and safe reset pass.        |
| Q3  | Passed | Human attested deliberate shared visibility, attribution, timestamp, persistence, and stable position pass.      |
| Q4  | Passed | Human attested both client roles can read/post shared comments without any internal selector or artifact.        |
| Q5  | Passed | Human attested clarification discussion and P003 revision continuity without comment-driven lifecycle changes.   |
| Q6  | Passed | Human attested both client-role internal-only API attempts return safe `403` without insertion or disclosure.    |
| Q7  | Passed | Human attested tenant/lifecycle/inaccessible denials and durable suspended-author attribution pass.              |
| Q8  | Passed | Human attested concurrent and paginated comments remain complete, unique, stable, and oldest-first.              |
| Q9  | Passed | Human attested validation, permission, network/server recovery, durable-state safety, and log redaction pass.    |
| Q10 | Passed | Human attested keyboard-only and narrow-viewport pagination, composition, feedback, and guidance pass.           |

## QA Decision

- Required QA complete: Yes.
- Human QA acceptance: Granted by the explicit statement, “Manual QA and
  testing passes,” on 2026-07-27.
- The human also stated that testing passes; no additional command transcript
  or counts were supplied, so the canonical automated evidence remains the
  candidate and accepted-fix validation recorded in the phase record.
- Browser/version, operating-system details, screenshots, and the exact session
  sequence were not supplied; these limitations are preserved rather than
  inferred.
- P004 completion and integration approval: Not granted by this QA statement.
