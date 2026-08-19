# Security Specification - MADAR Agency OS

## Data Invariants
1. A client document must always have a unique `clientCode`.
2. `remainingAmount` must always be `contractAmount - paidAmount`.
3. `monthlyValue` must be `contractAmount / contractMonths`.
4. Stage transitions must follow the flow: `received_from_sales` -> `cr_received` -> `sent_to_marketing_manager`.
5. `updateLog` must be updated whenever specific fields in `crData` or `marketingData` are modified.

## The Dirty Dozen Payloads (Rejection Tests)
1. **Anonymous Write**: Create a client without authentication. (Denied)
2. **Missing Required Fields**: Create a client without `clientCode`. (Denied)
3. **Invalid Stage**: Create a client with stage `invalid_stage`. (Denied)
4. **Invalid Amount**: Set `paidAmount` greater than `contractAmount`. (Denied - Logic check)
5. **Unauthorized Update**: Update `clientCode` after creation. (Denied - Immutable)
6. **Malicious ID**: Create a client with a 2MB string as document ID. (Denied - Size limit)
7. **Bypassing Paid Amount Logic**: Update `remainingAmount` manually to a value not equal to `contractAmount - paidAmount`. (Denied - Validation helper)
8. **Spoofing Author**: Setting `salesAgent` to a user string while not being that user (if we had roles, but for now we follow general safety).
9. **Invalid Website URL**: Providing a 1MB string for `websiteUrl`. (Denied - Size limit)
10. **Shadow Field Injection**: Adding a field `isAdmin: true` to a client document. (Denied - hasOnly check)
11. **Premature Stage Jump**: Moving stage from `received_from_sales` to `sent_to_marketing_manager` without `cr_received`. (Denied - transition logic)
12. **Negative Contract Amount**: Setting `contractAmount` to -100. (Denied - range check)

## Protection Strategy
- Global allow read/write is FALSE.
- Every collection has explicit rules.
- `isValidClient()` helper enforces schema and logic.
- `isAdmin()` check (using email list for now as requested).
