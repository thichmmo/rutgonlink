# Admin audit API

Audit rows are immutable through application APIs and searchable by admin, action, entity and reason. Raw before/after JSON is returned for forensic inspection; sensitive property names are redacted before storage.

Verification: perform mutations across user/link/domain/payment, then confirm actor, reason, IP and state transitions are visible.
