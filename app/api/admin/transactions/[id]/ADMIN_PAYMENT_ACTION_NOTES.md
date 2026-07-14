# Payment actions

Completed payments cannot be cancelled. Manual completion sets a deterministic transaction ID when none is provided and updates payment, subscription and user atomically.

Verification: finance role succeeds, support/viewer receive 403, audit contains reason and before/after state.
