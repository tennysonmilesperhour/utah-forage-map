import hashlib
import hmac
import os
import secrets

from passlib.context import CryptContext


DEFAULT_SECRET_KEY = "local-development-only-change-me"
SECRET_KEY = os.getenv("SECRET_KEY", DEFAULT_SECRET_KEY)
passwords = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def new_token() -> str:
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_identifier(value: str) -> str:
    return hmac.new(SECRET_KEY.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).hexdigest()
