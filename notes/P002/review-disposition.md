# P002 Review Disposition

> Status: All findings dispositioned by the human on 2026-07-26. Accepted fixes are authorized.

The human instructed Codex to “Address all issues,” accepting P002-F1 through
P002-F6, and later instructed Codex to address P002-F7 after Claude's focused
verification.

| Finding | Severity | Disposition | Reason and required correction                                                                                                                 |
| ------- | -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| P002-F1 | Medium   | Accepted    | Enforce the inviter's management ceiling against an existing suspended membership during create/resend/acceptance.                             |
| P002-F2 | Medium   | Accepted    | Clear identity-dependent TanStack Query state on sign-out and cross-identity establishment.                                                    |
| P002-F3 | Medium   | Accepted    | Add seven-day/resend-expiry and cross-tenant nested-ID `404` assertions; correct evidence claims.                                              |
| P002-F4 | Low      | Accepted    | Return no effective capabilities for globally suspended users.                                                                                 |
| P002-F5 | Low      | Accepted    | Add and document a validated `WEB_ACCEPTANCE_BASE_URL` with an explicit local fallback rule.                                                   |
| P002-F6 | Low      | Accepted    | Use route organization context when available and a neutral label for ambiguous multi-membership routes.                                       |
| P002-F7 | Medium   | Accepted    | Persist token-generation authorization state, keep valid invitations independent of later inviter lifecycle, and re-anchor authorized resends. |

P002-F1 through P002-F6 are applied in review-fix commit
`7ecacc31f0b5bac6d8bb773e260a01d1b3592818`
(`P002: address accepted review findings`).

P002-F7 is applied in review-fix commit
`0ccb535cd5e0c73184fc626ebd9233b3d2518482`
(`P002: preserve invitation authorization snapshots`).
