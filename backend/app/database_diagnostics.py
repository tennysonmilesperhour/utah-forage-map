import logging
import errno
import ipaddress
import re
import socket


logger = logging.getLogger(__name__)
_NETWORK_ERRNO_NAMES = {
    49: "EADDRNOTAVAIL", 99: "EADDRNOTAVAIL",
    51: "ENETUNREACH", 101: "ENETUNREACH",
    54: "ECONNRESET", 104: "ECONNRESET",
    60: "ETIMEDOUT", 110: "ETIMEDOUT",
    61: "ECONNREFUSED", 111: "ECONNREFUSED",
    65: "EHOSTUNREACH", 113: "EHOSTUNREACH",
}

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


def engine_target_type(url):
    """Classify a SQLAlchemy URL without returning or logging its hostname."""
    hostname = (getattr(url, "host", None) or "").lower().rstrip(".")
    if hostname in {"localhost", "127.0.0.1", "::1"}:
        return "loopback"
    if hostname.endswith(".neon.tech"):
        return "neon_pooled" if "-pooler." in hostname else "neon_direct"
    return "other" if hostname else "missing"


def resolve_address_families(hostname, port, resolver=socket.getaddrinfo):
    """Resolve a target for diagnostics; return counts only, never addresses."""
    if not hostname or not port:
        return {"a": 0, "aaaa": 0, "status": "missing_target"}
    try:
        results = resolver(hostname, port, type=socket.SOCK_STREAM)
    except socket.gaierror:
        return {"a": 0, "aaaa": 0, "status": "dns_error"}
    except (OSError, TimeoutError):
        return {"a": 0, "aaaa": 0, "status": "resolver_error"}

    addresses = {socket.AF_INET: set(), socket.AF_INET6: set()}
    for item in results[:32]:
        family = item[0]
        if family in addresses:
            addresses[family].add(item[4][0])
    return {
        "a": len(addresses[socket.AF_INET]),
        "aaaa": len(addresses[socket.AF_INET6]),
        "status": "resolved" if any(addresses.values()) else "no_addresses",
    }


def connection_error_category(message):
    text = message.lower()
    if "cannot assign requested address" in text:
        return "socket_address_unavailable"
    if "network is unreachable" in text:
        return "network_unreachable"
    if "timed out" in text or "timeout" in text:
        return "connect_timeout"
    if "could not translate host" in text or "name or service not known" in text:
        return "dns_resolution"
    if "connection refused" in text:
        return "connection_refused"
    if "password authentication failed" in text or "authentication failed" in text:
        return "authentication"
    if "ssl" in text or "tls" in text:
        return "tls"
    return "connection_error"


def safe_probe_failure(error):
    """Map a single DBAPI connect failure to a fixed, credential-free summary."""
    original = getattr(error, "orig", error)
    raw = " ".join(str(item) for item in (error, original, getattr(original, "__cause__", None)) if item)
    lowered = raw.lower()
    code = safe_database_error(error)["code"]
    os_code = None
    raw_errno = getattr(original, "errno", None)
    if not isinstance(raw_errno, int):
        match = re.search(r"\bErrno\s+(\d+)\b", raw)
        raw_errno = int(match.group(1)) if match else None
    if raw_errno is not None:
        os_code = _NETWORK_ERRNO_NAMES.get(raw_errno, errno.errorcode.get(raw_errno))

    if any(term in lowered for term in ("suspended", "endpoint not found", "endpoint does not exist", "compute is not active")):
        category, message = "endpoint_unavailable", "database endpoint unavailable or suspended"
    elif any(term in lowered for term in ("quota", "compute limit", "too many connections", "too many clients")):
        category, message = "quota_or_compute_limit", "database quota or compute limit reported"
    elif "channel binding" in lowered or "ssl" in lowered or "tls" in lowered or "certificate" in lowered:
        category, message = "tls_or_channel_binding", "TLS or channel-binding negotiation failed"
    elif "password authentication failed" in lowered or "authentication failed" in lowered:
        category, message = "authentication", "database authentication failed"
    else:
        category = connection_error_category(lowered)
        message = {
            "connect_timeout": "database connection timed out",
            "connection_refused": "database connection was refused",
            "socket_address_unavailable": "socket could not assign an outbound address",
            "network_unreachable": "database network was unreachable",
            "dns_resolution": "database hostname could not be resolved",
            "tls": "TLS negotiation failed",
            "authentication": "database authentication failed",
        }.get(category, "unclassified database connection failure")

    return {
        "error_class": type(error).__name__,
        "driver_error_class": type(original).__name__,
        "code": code,
        "os_code": os_code,
        "category": category,
        "message": message,
    }


def probe_ipv4_database_connection(engine, resolver=socket.getaddrinfo, connect=None):
    """Attempt one bounded IPv4 DBAPI connection using the existing engine URL."""
    url = engine.url
    hostname = getattr(url, "host", None)
    port = getattr(url, "port", None) or 5432
    if not hostname:
        logger.error("database_ipv4_probe status=skipped category=missing_target")
        return
    try:
        records = resolver(hostname, port, family=socket.AF_INET, type=socket.SOCK_STREAM)
    except socket.gaierror:
        logger.error("database_ipv4_probe status=failed category=dns_resolution code=none os_code=none message=IPv4 resolution failed")
        return
    except (OSError, TimeoutError):
        logger.error("database_ipv4_probe status=failed category=resolver_error code=none os_code=none message=IPv4 resolver failed")
        return
    if not records:
        logger.error("database_ipv4_probe status=failed category=no_ipv4_address code=none os_code=none message=no IPv4 address resolved")
        return

    hostaddr = records[0][4][0]
    args, params = engine.dialect.create_connect_args(url)
    params.update({"host": hostname, "hostaddr": hostaddr, "port": port, "connect_timeout": 5})
    try:
        dbapi_connect = connect or engine.dialect.connect
        connection = dbapi_connect(*args, **params)
        connection.close()
    except Exception as error:
        details = safe_probe_failure(error)
        logger.error(
            "database_ipv4_probe status=failed error_class=%s driver_error_class=%s code=%s os_code=%s category=%s message=%s",
            details["error_class"], details["driver_error_class"], details["code"] or "none",
            details["os_code"] or "none", details["category"], details["message"],
        )
        return
    logger.info("database_ipv4_probe status=connected category=none code=none os_code=none message=connection succeeded")


def connection_attempt_summary(error):
    """Summarize psycopg multi-address failures without retaining addresses."""
    original = getattr(error, "orig", error)
    message = str(original)
    marker = "All failures were:"
    if marker not in message:
        return {
            "ipv4": 0, "ipv6": 0, "other": 0, "categories": {},
            "ipv4_categories": {}, "ipv6_categories": {},
            "ipv4_errors": {}, "ipv6_errors": {},
        }

    failures = message.split(marker, 1)[1]
    blocks = re.findall(r"(?ms)^\s*-\s*host:.*?(?=^\s*-\s*host:|\Z)", failures)[:32]
    summary = {
        "ipv4": 0, "ipv6": 0, "other": 0, "categories": {},
        "ipv4_categories": {}, "ipv6_categories": {},
        "ipv4_errors": {}, "ipv6_errors": {},
    }
    for block in blocks:
        match = re.search(r"\bhostaddr\s*:\s*['\"]?(\[[^\]]+\]|[^,\s'\"]+)", block)
        address = match.group(1).strip("[]") if match else ""
        try:
            version = ipaddress.ip_address(address).version
            family = "ipv4" if version == 4 else "ipv6"
        except ValueError:
            family = "other"
        summary[family] += 1
        category = connection_error_category(block)
        summary["categories"][category] = summary["categories"].get(category, 0) + 1
        if family in {"ipv4", "ipv6"}:
            family_categories = summary[f"{family}_categories"]
            family_categories[category] = family_categories.get(category, 0) + 1
            code_match = re.search(r"\bErrno\s+(\d+)\b", block)
            code_number = int(code_match.group(1)) if code_match else None
            code_name = (
                _NETWORK_ERRNO_NAMES.get(code_number, errno.errorcode.get(code_number, "UNKNOWN"))
                if code_number is not None else "none"
            )
            family_errors = summary[f"{family}_errors"]
            family_errors[code_name] = family_errors.get(code_name, 0) + 1
    return summary


def log_database_error(error, url=None, resolver=socket.getaddrinfo):
    details = safe_database_error(error)
    hostname = getattr(url, "host", None)
    port = getattr(url, "port", None)
    if port is None and engine_target_type(url).startswith("neon_"):
        # SQLAlchemy/psycopg use PostgreSQL's default port when it is omitted.
        port = 5432
    target = engine_target_type(url)
    dns = resolve_address_families(hostname, port, resolver)
    category = connection_error_category(details["message"])
    attempts = connection_attempt_summary(error)
    attempt_categories = ",".join(
        f"{name}:{count}" for name, count in sorted(attempts["categories"].items())
    ) or "none"
    ipv4_categories = ",".join(
        f"{name}:{count}" for name, count in sorted(attempts["ipv4_categories"].items())
    ) or "none"
    ipv6_categories = ",".join(
        f"{name}:{count}" for name, count in sorted(attempts["ipv6_categories"].items())
    ) or "none"
    ipv4_errors = ",".join(
        f"{name}:{count}" for name, count in sorted(attempts["ipv4_errors"].items())
    ) or "none"
    ipv6_errors = ",".join(
        f"{name}:{count}" for name, count in sorted(attempts["ipv6_errors"].items())
    ) or "none"
    logger.error(
        "database_connection_diagnostic target=%s dns_a=%s dns_aaaa=%s dns_status=%s category=%s",
        target, dns["a"], dns["aaaa"], dns["status"], category,
    )
    logger.error(
        "database_connection_attempts ipv4=%s ipv6=%s other=%s categories=%s ipv4_categories=%s ipv6_categories=%s ipv4_errors=%s ipv6_errors=%s",
        attempts["ipv4"], attempts["ipv6"], attempts["other"], attempt_categories,
        ipv4_categories, ipv6_categories, ipv4_errors, ipv6_errors,
    )
    logger.error(
        "database_error sqlalchemy_error=%s driver_error=%s code=%s message=%s",
        details["sqlalchemy_error"],
        details["driver_error"],
        details["code"] or "none",
        details["message"],
    )
