# Dynamic Google OAuth

The NextAuth route resolves encrypted Google credentials for every auth request, so admin changes apply immediately. Session-only server calls keep the static callback configuration and do not need to query integration settings.

Verification: `/api/auth/providers` adds or removes `google` immediately after an owner saves or clears the database override.
