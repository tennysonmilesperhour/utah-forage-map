import unittest
import socket
from types import SimpleNamespace

from app.database_diagnostics import (
    connection_error_category,
    connection_attempt_summary,
    engine_target_type,
    log_database_error,
    resolve_address_families,
    safe_database_error,
)


class DatabaseDiagnosticsTests(unittest.TestCase):
    class OperationalError(Exception):
        pass

    def test_connection_error_keeps_driver_reason_and_sqlstate_but_redacts_secrets(self):
        original = RuntimeError(
            'could not translate host name "ep-private.neon.tech" to address: '
            'password authentication failed for user "db_owner" '
            'password=do-not-log email=private@example.com '
            'postgres://db_owner:do-not-log@ep-private.neon.tech/db'
        )
        original.sqlstate = "28P01"
        error = self.OperationalError("query must not be logged")
        error.orig = original

        details = safe_database_error(error)

        self.assertEqual(details["sqlalchemy_error"], "OperationalError")
        self.assertEqual(details["driver_error"], "RuntimeError")
        self.assertEqual(details["code"], "28P01")
        self.assertIn("could not translate host name [redacted]", details["message"])
        self.assertIn("password authentication failed for user [redacted]", details["message"])
        for secret in ("ep-private.neon.tech", "db_owner", "do-not-log", "private@example.com", "SELECT *"):
            self.assertNotIn(secret, details["message"])

        with self.assertLogs("app.database_diagnostics", level="ERROR") as captured:
            log_database_error(error)
        for secret in ("ep-private.neon.tech", "db_owner", "do-not-log", "private@example.com", "SELECT *"):
            self.assertNotIn(secret, "\n".join(captured.output))

    def test_invalid_codes_and_long_messages_are_bounded(self):
        original = RuntimeError("x" * 500)
        original.sqlstate = "password=private"
        details = safe_database_error(original)

        self.assertIsNone(details["code"])
        self.assertEqual(len(details["message"]), 240)

    def test_target_classification_identifies_pooled_and_direct_without_host(self):
        pooled = SimpleNamespace(host="ep-example-pooler.us-east-1.aws.neon.tech", port=5432)
        direct = SimpleNamespace(host="ep-example.us-east-1.aws.neon.tech", port=5432)
        self.assertEqual(engine_target_type(pooled), "neon_pooled")
        self.assertEqual(engine_target_type(direct), "neon_direct")
        self.assertEqual(engine_target_type(SimpleNamespace(host=None, port=None)), "missing")

    def test_dns_diagnostic_counts_addresses_without_exposing_them(self):
        def resolver(_host, _port, type):
            self.assertEqual(type, socket.SOCK_STREAM)
            return [
                (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("192.0.2.2", 5432)),
                (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("192.0.2.3", 5432)),
                (socket.AF_INET6, socket.SOCK_STREAM, 6, "", ("2001:db8::2", 5432, 0, 0)),
            ]

        result = resolve_address_families("private.neon.tech", 5432, resolver)
        self.assertEqual(result, {"a": 2, "aaaa": 1, "status": "resolved"})
        self.assertNotIn("192.0.2.2", str(result))

    def test_connection_error_category_is_coarse(self):
        self.assertEqual(
            connection_error_category("Cannot assign requested address"),
            "socket_address_unavailable",
        )

    def test_multi_address_connection_summary_keeps_only_family_and_category(self):
        error = self.OperationalError("ignored wrapper")
        error.orig = RuntimeError(
            "Multiple connection attempts failed. All failures were:\n"
            "- host: 'private-one.neon.tech', port: 5432, hostaddr: '192.0.2.10': "
            "connection failed: [Errno 110] Connection timed out\n"
            "- host: 'private-two.neon.tech', port: 5432, hostaddr: '2001:db8::2': "
            "connection failed: [Errno 99] Cannot assign requested address"
        )
        summary = connection_attempt_summary(error)
        self.assertEqual(summary["ipv4"], 1)
        self.assertEqual(summary["ipv6"], 1)
        self.assertEqual(summary["other"], 0)
        self.assertEqual(summary["categories"], {"connect_timeout": 1, "socket_address_unavailable": 1})
        self.assertEqual(summary["ipv4_categories"], {"connect_timeout": 1})
        self.assertEqual(summary["ipv6_categories"], {"socket_address_unavailable": 1})
        self.assertEqual(summary["ipv4_errors"], {"ETIMEDOUT": 1})
        self.assertEqual(summary["ipv6_errors"], {"EADDRNOTAVAIL": 1})
        self.assertNotIn("private-one", str(summary))
        self.assertNotIn("192.0.2.10", str(summary))

    def test_runtime_log_exposes_only_target_type_and_address_counts(self):
        error = self.OperationalError("connection to server at [redacted] failed: Cannot assign requested address")
        url = SimpleNamespace(host="ep-private-pooler.us-east-1.aws.neon.tech", port=None)

        def resolver(_host, port, type):
            self.assertEqual(type, socket.SOCK_STREAM)
            self.assertEqual(port, 5432)
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("192.0.2.2", 5432))]

        with self.assertLogs("app.database_diagnostics", level="ERROR") as captured:
            log_database_error(error, url, resolver)
        output = "\n".join(captured.output)
        self.assertIn("target=neon_pooled dns_a=1 dns_aaaa=0 dns_status=resolved", output)
        self.assertIn("category=socket_address_unavailable", output)
        self.assertNotIn(url.host, output)
        self.assertNotIn("192.0.2.2", output)


if __name__ == "__main__":
    unittest.main()
