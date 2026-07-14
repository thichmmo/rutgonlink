# Manual payment reconciliation

An unresolved SePay event may be matched to a pending payment only when received amount is sufficient. Activation and event resolution run in one transaction and are audited.

Verification: underpaid matching returns 400; valid matching activates exactly one payment and marks the event `manually_matched`.
