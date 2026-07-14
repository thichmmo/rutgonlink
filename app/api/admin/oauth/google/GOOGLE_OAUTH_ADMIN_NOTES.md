# Google OAuth admin API

System readers can inspect provider status and callback URLs. Only the owner can save or clear credentials; Client Secret is encrypted before storage, never returned, and audit data contains status only.

Verification: owner PUT changes `/api/auth/providers` immediately, blank secret preserves the stored secret, DELETE falls back to environment configuration, and non-owner writes return 403.
