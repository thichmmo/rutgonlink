# Web phim admin mutations

System-write permission protects redirect-link/config mutations. Create, update, delete and desktop redirect changes write audit records; reads require system-read.

Verification: mutate each operation as ops/owner and confirm audit entries, then verify viewer writes return 403.
