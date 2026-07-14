# Dashboard admin navigation

Desktop sidebar, mobile drawer and bottom navigation add an `Admin` entry only when the active session has `isAdmin`. The flag is refreshed from `ADMIN_EMAIL` or the user's database `adminRole` by the JWT callback.

Verification: owner/admin roles see `/admin` directly after Settings; normal users never receive the item and direct admin access remains server-protected.
