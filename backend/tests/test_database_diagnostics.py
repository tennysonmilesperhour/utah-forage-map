import unittest

from app.database_diagnostics import log_database_error, safe_database_error


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


if __name__ == "__main__":
    unittest.main()
