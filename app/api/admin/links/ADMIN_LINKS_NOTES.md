# Admin link moderation API

Global listing supports owner/domain/URL search and moderation filters. Disable/enable actions require a reason, preserve an admin marker and write audit rows. Redirect resolution also rejects suspended owners and disabled custom domains.

Verification: disable a live link, confirm redirect returns 404, then enable it and confirm the original state is restored.
