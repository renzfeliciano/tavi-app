# Third-party skills

Vendored into this repo for use with Claude Code. Each is unmodified from source except where noted. Update by re-copying from the source repo and bumping the commit hash below.

| Skill | Source | Commit | License |
|---|---|---|---|
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | `0d2b646` | MIT |
| `nextjs-shadcn` | [laguagu/claude-code-nextjs-skills](https://github.com/laguagu/claude-code-nextjs-skills) | `7c5cb7e` | MIT |
| `next-best-practices` | [laguagu/claude-code-nextjs-skills](https://github.com/laguagu/claude-code-nextjs-skills) | `7c5cb7e` | MIT |
| `frontend-design` | [laguagu/claude-code-nextjs-skills](https://github.com/laguagu/claude-code-nextjs-skills) | `7c5cb7e` | MIT |
| `emil-design-eng` | [emilkowalski/skills](https://github.com/emilkowalski/skills) (`skills/emil-design-eng`) | `d16ebe6` | MIT |
| `impeccable` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (`.claude/skills/impeccable`, v4.4.0) | `9d715cc` | Apache-2.0 (see `impeccable/NOTICE.md`) |
| `taste-skill` (skill name `design-taste-frontend`) | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) (`skills/taste-skill`) | `ce26fc2` | MIT |

Notes:
- `frontend-design` was pulled in because `nextjs-shadcn/SKILL.md` requires loading it before the first component of a new view.
- `ui-ux-pro-max/scripts/tests/` was intentionally omitted — those are the upstream project's own dev-time tests for its search tool, not needed to use the skill.
- Only `nextjs-shadcn` and `next-best-practices` were pulled from `claude-code-nextjs-skills`; the rest of that repo's skills (ai-sdk, shadcn, chrome-devtools, supabase-postgres-best-practices, etc.) were left out as out of scope.
- `ui-ux-pro-max/scripts/search.py` requires Python 3 on PATH to run; check availability before relying on it (`python3 --version` / `py -3 --version`).
- `impeccable/scripts/` was intentionally omitted. Its launcher (`scripts/impeccable`) downloads a prebuilt engine binary from the project's GitHub releases into `~/.impeccable` on first run and executes it, and the skill's Setup step runs it every session (its `hooks` command also runs it after every UI edit). We keep that opt-in rather than letting it happen silently: without `scripts/`, the skill takes its documented "Launcher unavailable" path and reads PRODUCT.md/DESIGN.md directly. All the design guidance (`craft-floor`, `operate`, `polish`, `audit`, `critique`, `typeset`, `layout`, …) works as-is; the engine-only commands (`live`, `generate`, `hooks`, `doctor`, `detect`) don't. To opt in, copy `.claude/skills/impeccable/scripts/` from the same commit.
- `impeccable/NOTICE.md` is copied from the repo root, as Apache-2.0 §4(d) requires.
- From `emilkowalski/skills`, only the web design-engineering skill was taken; its iOS/Expo/Swift skills (`animate-expo`, `mobile-native`, `write-swift`, `apple-design`) are out of scope for this web app.
- From `Leonxlnx/taste-skill`, only the main `taste-skill` was taken, not its style variants (`brutalist`, `soft`, `minimalist`, image-gen, …). Its own §13 scopes it to landing/marketing surfaces, **not dashboards, admin panels, or data tables**, so in TAVI it applies to the marketing page only, not the app or the public portals.
- **Precedence in TAVI (decided 2026-09-30, docs/foundation-proposal.md §F.4):** (1) `docs/foundation-proposal.md` and `DESIGN.md` (once written in Phase 0.4) win over every vendored skill; (2) `impeccable` and `emil-design-eng` guide the product UI — the authenticated app and the public quote/invoice portals; (3) `taste-skill` applies to the marketing/landing page only (its own §13 excludes dashboards and data tables); (4) `nextjs-shadcn` and `next-best-practices` govern implementation, always checked against the Next.js docs bundled in `node_modules/next/dist/docs/`; (5) `frontend-design` and `ui-ux-pro-max` are reference material only. No brand gradients, no coloured glow shadows, one brand accent (chosen with the mascot in Phase 0.4). Keep these at their upstream HEAD when updating.
