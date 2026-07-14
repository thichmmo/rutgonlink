# Link moderation mutation

Only links marked `disabledByAdmin` may be re-enabled by admin, preventing accidental activation of links the user had already disabled.

Verification: PATCH disable/enable with support and viewer roles; viewer must receive 403 and both successful actions must create audit rows.
