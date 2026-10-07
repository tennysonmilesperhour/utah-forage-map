"""Traffic log for AI crawlers and tools, with write, summary and prune functions (additive)."""
from alembic import op
import sqlalchemy as sa

revision = "a1c5d9e03f72"
down_revision = "e6b71d8c2a90"
branch_labels = None
depends_on = None

LOG_FUNCTION = """
CREATE OR REPLACE FUNCTION agent_traffic_log(p_agent text, p_kind text, p_path text, p_user_agent text)
RETURNS void LANGUAGE sql AS $$
    INSERT INTO agent_traffic (agent, kind, path, user_agent, created_at)
    VALUES (
        COALESCE(NULLIF(left(btrim(COALESCE(p_agent, '')), 60), ''), 'unknown'),
        CASE WHEN p_kind IN ('training', 'search', 'assistant', 'seo', 'tool') THEN p_kind ELSE 'tool' END,
        COALESCE(NULLIF(left(btrim(COALESCE(p_path, '')), 300), ''), '/'),
        left(btrim(COALESCE(p_user_agent, '')), 300),
        (now() AT TIME ZONE 'utc')
    );
$$;
"""

SUMMARY_FUNCTION = """
CREATE OR REPLACE FUNCTION agent_traffic_summary(p_days integer)
RETURNS jsonb LANGUAGE sql STABLE AS $$
    WITH bounds AS (
        SELECT (now() AT TIME ZONE 'utc') AS period_end,
               (now() AT TIME ZONE 'utc') - make_interval(days => p_days) AS period_start,
               (now() AT TIME ZONE 'utc') - make_interval(days => p_days * 2) AS previous_start
    ),
    cur AS (SELECT t.* FROM agent_traffic t, bounds b WHERE t.created_at >= b.period_start),
    prev AS (SELECT t.* FROM agent_traffic t, bounds b WHERE t.created_at >= b.previous_start AND t.created_at < b.period_start)
    SELECT jsonb_build_object(
        'days', p_days,
        'period_start', (SELECT to_char(period_start, 'YYYY-MM-DD"T"HH24:MI:SS.US') FROM bounds),
        'period_end', (SELECT to_char(period_end, 'YYYY-MM-DD"T"HH24:MI:SS.US') FROM bounds),
        'hits', (SELECT count(*) FROM cur),
        'previous_hits', (SELECT count(*) FROM prev),
        'by_agent', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('agent', agent, 'kind', kind, 'hits', hits,
                   'previous_hits', COALESCE((SELECT count(*) FROM prev p WHERE p.agent = c.agent AND p.kind = c.kind), 0))
                   ORDER BY hits DESC, agent)
            FROM (SELECT agent, kind, count(*) AS hits FROM cur GROUP BY agent, kind) c), '[]'::jsonb),
        'by_kind', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('kind', kind, 'hits', hits) ORDER BY hits DESC, kind)
            FROM (SELECT kind, count(*) AS hits FROM cur GROUP BY kind) k), '[]'::jsonb),
        'top_paths', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('path', path, 'hits', hits) ORDER BY hits DESC, path)
            FROM (SELECT path, count(*) AS hits FROM cur GROUP BY path ORDER BY count(*) DESC, path LIMIT 25) p), '[]'::jsonb),
        'agent_file_hits', (SELECT count(*) FROM cur
            WHERE path = '/llms.txt' OR path LIKE '%.md' OR path LIKE '/llms%' OR path LIKE '/data/%'
               OR path LIKE '/mcp%' OR path LIKE '/.well-known/%'),
        'mcp_hits', (SELECT count(*) FROM cur WHERE path = '/mcp'),
        'unknown_user_agents', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('user_agent', user_agent, 'hits', hits) ORDER BY hits DESC, user_agent)
            FROM (SELECT user_agent, count(*) AS hits FROM cur WHERE agent = 'unknown'
                  GROUP BY user_agent ORDER BY count(*) DESC, user_agent LIMIT 20) u), '[]'::jsonb),
        'daily', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('date', day, 'hits', hits) ORDER BY day)
            FROM (SELECT to_char(created_at, 'YYYY-MM-DD') AS day, count(*) AS hits FROM cur GROUP BY 1) d), '[]'::jsonb)
    )
$$;
"""

PRUNE_FUNCTION = """
CREATE OR REPLACE FUNCTION agent_traffic_prune(p_days integer)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE removed integer;
BEGIN
    DELETE FROM agent_traffic WHERE created_at < (now() AT TIME ZONE 'utc') - make_interval(days => p_days);
    GET DIAGNOSTICS removed = ROW_COUNT;
    RETURN removed;
END;
$$;
"""


def upgrade():
    op.create_table(
        "agent_traffic",
        sa.Column("id", sa.BigInteger().with_variant(sa.Integer, "sqlite"), primary_key=True, autoincrement=True),
        sa.Column("agent", sa.String(60), nullable=False),
        sa.Column("kind", sa.String(12), nullable=False),
        sa.Column("path", sa.String(300), nullable=False),
        sa.Column("user_agent", sa.String(300), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_agent_traffic_created_at", "agent_traffic", ["created_at"])
    if op.get_bind().dialect.name != "postgresql":
        return
    for statement in (LOG_FUNCTION, SUMMARY_FUNCTION, PRUNE_FUNCTION):
        op.execute(statement)
    # Reads and writes go through the API; no other database role gets access by default.
    op.execute("REVOKE ALL ON TABLE agent_traffic FROM PUBLIC")
    op.execute("REVOKE ALL ON SEQUENCE agent_traffic_id_seq FROM PUBLIC")
    for signature in (
        "agent_traffic_log(text, text, text, text)",
        "agent_traffic_summary(integer)",
        "agent_traffic_prune(integer)",
    ):
        op.execute(f"REVOKE ALL ON FUNCTION {signature} FROM PUBLIC")


def downgrade():
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP FUNCTION IF EXISTS agent_traffic_prune(integer)")
        op.execute("DROP FUNCTION IF EXISTS agent_traffic_summary(integer)")
        op.execute("DROP FUNCTION IF EXISTS agent_traffic_log(text, text, text, text)")
    op.drop_index("ix_agent_traffic_created_at", table_name="agent_traffic")
    op.drop_table("agent_traffic")
