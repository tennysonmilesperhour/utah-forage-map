from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv
import os
from app.database_diagnostics import log_database_error

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./utah_forage_map.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

# Fluid keeps a Python process across requests. A QueuePool holds Postgres
# sessions open after the instance is frozen, which fills Neon's connection
# limit and then every query fails. Open one connection per request instead.
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    pool_kwargs = {}
else:
    connect_args = {"connect_timeout": 10}
    pool_kwargs = {"poolclass": NullPool}

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True, **pool_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    except SQLAlchemyError as error:
        log_database_error(error)
        raise
    finally:
        db.close()
