# Project rules

Read [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md) before changing copy, layout or data. They win over anything convenient.

- Guest first. The public map and guides work without an account.
- Protect places and people. Never publish exact coordinates (public points are shifted 1 to 2.5 miles), private logbooks, owner ids or unreviewed submissions.
- Never state or imply that a map observation, a guide or an AI answer confirms a mushroom is edible. Agent-facing output carries: "A map observation is not an identification. Never eat a wild mushroom based on this data."
- No em dashes or en dashes in any copy, in comments that become docs, or in generated files. Use commas, colons or full stops.
- Work on the branch the task names and open a draft pull request against `main`.
- Database is Neon Postgres (SQLAlchemy and Alembic in `backend/`). The frontend and the `/mcp` function deploy as the `utah-forage-map` Vercel project, the API as `utah-forage-api`.

## Agent access layer

AI-facing files, open data, the MCP server and the weekly review are described in [docs/planning/agent-access-2026-10.md](docs/planning/agent-access-2026-10.md). Read it before touching `frontend/scripts/build-agent-access.mjs`, `frontend/server/mcp.js`, `frontend/middleware.js`, `backend/app/agent_traffic.py` or `docs/agent-review/`. The weekly review log lives at the bottom of that file.
