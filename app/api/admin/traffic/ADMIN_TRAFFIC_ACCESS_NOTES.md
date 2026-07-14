# Traffic admin access

Traffic analytics uses centralized `logs.read` permission rather than a single hardcoded admin email.

Verification: viewer can read traffic; a normal user receives 403.
