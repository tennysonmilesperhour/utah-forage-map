import logging
import re


logger = logging.getLogger(__name__)

_CONNECTION_URL = re.compile(r"(?i)\bpostgres(?:ql)?(?:\+\w+)?://[^\s)]+")
_KEY_VALUE = re.compile(
    r"(?i)\b(password|passwd|passfile|user|username|dbname|database|host|hostaddr|hostname|token|secret|authorization|api[_-]?key|access[_-]?token|client[_-]?secret)\s*=\s*(?:\"[^\"]*\"|'[^']*'|[^\s,;]+)"
)
_NAMED_VALUE = re.compile(r"(?i)\b(host(?:name)?(?:\s+name)?|user|username|database|dbname)\s+['\"][^'\"]+['\"]")
_SERVER_AT = re.compile(r"(?i)\bserver\s+at\s+['\"][^'\"]+['\"]")
_AUTH_USER = re.compile(r"(?i)(password authentication failed for user)\s+['\"][^'\"]+['\"]")
_IP_ADDRESS = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
_EMAIL = re.compile(r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b")


def safe_database_error(error):
    """Return bounded error metadata without credentials, hosts, or SQL parameters."""
    original = getattr(error, "orig", error)
    raw_code = getattr(original, "sqlstate", None) or getattr(original, "pgcode", None)
    code = raw_code if isinstance(raw_code, str) and re.fullmatch(r"[0-9A-Z]{5}", raw_code) else None

    message = str(original)
    message = _CONNECTION_URL.sub("postgresql://[redacted]", message)
    message = _KEY_VALUE.sub(lambda match: f"{match.group(1)}=[redacted]", message)
    message = _AUTH_USER.sub(r"\1 [redacted]", message)
    message = _NAMED_VALUE.sub(lambda match: f"{match.group(1)} [redacted]", message)
    message = _SERVER_AT.sub("server at [redacted]", message)
    message = _IP_ADDRESS.sub("[redacted address]", message)
    message = _EMAIL.sub("[redacted email]", message)
    message = " ".join(message.split())[:240]

    return {
        "sqlalchemy_error": type(error).__name__,
        "driver_error": type(original).__name__,
        "code": code,
        "message": message,
    }


def log_database_error(error):
    details = safe_database_error(error)
    logger.error(
        "database_error sqlalchemy_error=%s driver_error=%s code=%s message=%s",
        details["sqlalchemy_error"],
        details["driver_error"],
        details["code"] or "none",
        details["message"],
    )
