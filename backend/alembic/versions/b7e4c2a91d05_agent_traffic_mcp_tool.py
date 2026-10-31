"""Record the MCP tool name (never its arguments) on agent traffic rows (additive)."""
import importlib.util
from pathlib import Path

from alembic import op
import sqlalchemy as sa

revision = "b7e4c2a91d05"
down_revision = "a1c5d9e03f72"
branch_labels = None
depends_on = None

# New five-argument overload. The four-argument function stays, so an API deploy that is
# still on the old code keeps logging while this migration rolls out.
LOG_FUNCTION = """
CREATE OR REPLACE FUNCTION agent_traffic_log(p_agent text, p_kind text, p_path text, p_user_agent text, p_mcp_tool text)
RETURNS void LANGUAGE sql AS $$
    INSERT INTO agent_traffic (agent, kind, path, user_agent, mcp_tool, created_at)
    VALUES (
        COALESCE(NULLIF(left(btrim(COALESCE(p_agent, '')), 60), ''), 'unknown'),
        CASE WHEN p_kind IN ('training', 'search', 'assistant', 'seo', 'tool') THEN p_kind ELSE 'tool' END,
        COALESCE(NULLIF(left(btrim(COALESCE(p_path, '')), 300), ''), '/'),
        left(btrim(COALESCE(p_user_agent, '')), 300),
        NULLIF(left(regexp_replace(COALESCE(p_mcp_tool, ''), '[^A-Za-z0-9_.-]', '', 'g'), 60), ''),
        (now() AT TIME ZONE 'utc')
    );
$$;
"""

MCP_TOOLS = """
        'mcp_tools', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('tool', mcp_tool, 'hits', hits) ORDER BY hits DESC, mcp_tool)
            FROM (SELECT mcp_tool, count(*) AS hits FROM cur WHERE mcp_tool IS NOT NULL GROUP BY mcp_tool) m), '[]'::jsonb),"""


def _previous():
    path = Path(__file__).with_name("a1c5d9e03f72_agent_traffic_log.py")
    spec = importlib.util.spec_from_file_location("agent_traffic_log_a1c5d9e03f72", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# Text sort keys use byte order (COLLATE "C") so ties come out in the same order as the
# Python summary whatever collation the database was created with (Neon and CI default to
# en_US, which ignores punctuation and would put "ClaudeBot" before "Claude-User").
BYTE_ORDER = [
    ("ORDER BY hits DESC, agent)", 'ORDER BY hits DESC, agent COLLATE "C")'),
    ("ORDER BY hits DESC, kind)", 'ORDER BY hits DESC, kind COLLATE "C")'),
    ("ORDER BY hits DESC, path)", 'ORDER BY hits DESC, path COLLATE "C")'),
    ("ORDER BY count(*) DESC, path LIMIT", 'ORDER BY count(*) DESC, path COLLATE "C" LIMIT'),
    ("ORDER BY hits DESC, user_agent)", 'ORDER BY hits DESC, user_agent COLLATE "C")'),
    ("ORDER BY count(*) DESC, user_agent LIMIT", 'ORDER BY count(*) DESC, user_agent COLLATE "C" LIMIT'),
    ("ORDER BY hits DESC, mcp_tool)", 'ORDER BY hits DESC, mcp_tool COLLATE "C")'),
]


def summary_with_tools(summary_sql: str) -> str:
    anchor = "\n        'unknown_user_agents',"
    if anchor not in summary_sql:
        raise RuntimeError("agent_traffic_summary layout changed; update this migration")
    sql = summary_sql.replace(anchor, MCP_TOOLS + anchor, 1)
    for old, new in BYTE_ORDER:
        if old not in sql:
            raise RuntimeError(f"agent_traffic_summary layout changed near {old!r}; update this migration")
        sql = sql.replace(old, new)
    return sql


def upgrade():
    op.add_column("agent_traffic", sa.Column("mcp_tool", sa.String(60), nullable=True))
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute(LOG_FUNCTION)
    op.execute(summary_with_tools(_previous().SUMMARY_FUNCTION))
    op.execute("REVOKE ALL ON FUNCTION agent_traffic_log(text, text, text, text, text) FROM PUBLIC")
    op.execute("REVOKE ALL ON FUNCTION agent_traffic_summary(integer) FROM PUBLIC")


def downgrade():
    if op.get_bind().dialect.name == "postgresql":
        op.execute(_previous().SUMMARY_FUNCTION)
        op.execute("REVOKE ALL ON FUNCTION agent_traffic_summary(integer) FROM PUBLIC")
        op.execute("DROP FUNCTION IF EXISTS agent_traffic_log(text, text, text, text, text)")
    op.drop_column("agent_traffic", "mcp_tool")
