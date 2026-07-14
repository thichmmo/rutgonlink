# Google OAuth admin UI

Owners can enter the Google Client ID and a write-only Client Secret, view the exact login/Drive callbacks, test sign-in and clear the database override. Read-only roles can inspect status without editing credentials.

Verification: secret is never hydrated into the form, blank secret preserves the current encrypted value, and destructive clear requires confirmation plus an audit reason.
