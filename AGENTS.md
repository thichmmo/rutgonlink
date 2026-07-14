# Repository Working Notes

## Skill Usage

- Before changing code, inspect `codex/README.md` and the relevant `codex/skills/*/SKILL.md` file when the task matches a local skill.
- Prefer the local skill workflow over ad hoc implementation when a matching skill exists.
- Do not edit auto-generated skill files directly when they contain a generated-file warning; update the source/template or a repository guidance file instead.

## Code Change Notes

- When changing code in a folder, add or update a Markdown note in that folder explaining the purpose, behavior, and verification for the change.
- Keep notes concise and useful for future debugging. Do not duplicate obvious code behavior.
- Add short `//` comments near new non-obvious logic, edge cases, background jobs, retries, token fallback, or data transformations.
- Avoid noisy comments for trivial assignments, simple JSX, or self-explanatory code.

## Verification

- Run the smallest reliable verification first, then broaden testing when the change touches shared behavior or production-facing APIs.
- Include the verification command/result in the final response.
