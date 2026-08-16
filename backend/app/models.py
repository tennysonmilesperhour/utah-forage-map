import uuid
from datetime import datetime, date
from sqlalchemy import (
    Boolean, Column, Date, DateTime, Float, ForeignKey,
    Index, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from sqlalchemy.types import CHAR, TypeDecorator

from app.database import Base


class GUID(TypeDecorator):
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value
        if not isinstance(value, uuid.UUID):
            value = uuid.UUID(str(value))
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None or isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(str(value))


class User(Base):
    __tablename__ = "users"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="user")
    trust_level = Column(Integer, default=0)
    total_finds = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)
    email_verified_at = Column(DateTime)
    joined_at = Column(DateTime, default=datetime.utcnow)
    deleted_at = Column(DateTime)

    sightings = relationship("Sighting", back_populates="user", foreign_keys="Sighting.user_id")
    verifications = relationship("Verification", back_populates="verifier")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    account_tokens = relationship("AccountToken", back_populates="user", cascade="all, delete-orphan")
    saved_locations = relationship("SavedLocation", back_populates="user", cascade="all, delete-orphan")


class Species(Base):
    __tablename__ = "species"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    common_name = Column(String, nullable=False)
    latin_name = Column(String, nullable=False)
    inaturalist_taxon_id = Column(Integer, unique=True)
    edibility = Column(String)
    look_alikes = Column(Text)
    habitat_notes = Column(Text)
    peak_months = Column(String)  # comma-separated ints e.g. "4,5,6"
    elevation_min_ft = Column(Integer)
    elevation_max_ft = Column(Integer)
    range_notes = Column(String)
    notes = Column(Text)

    sightings = relationship("Sighting", back_populates="species")


class Sighting(Base):
    __tablename__ = "sightings"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    species_id = Column(GUID(), ForeignKey("species.id"), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    elevation_ft = Column(Float)
    found_on = Column(Date)
    month = Column(Integer)
    habitat_type = Column(String)
    substrate = Column(String)
    place_name = Column(String(160))  # coarse locality, e.g. "Bavaria, Germany"
    notes = Column(Text)
    photo_url = Column(String)
    source = Column(String, default="community")
    confidence_score = Column(Integer, default=50)
    verified = Column(Boolean, default=False)
    location_privacy = Column(String, default="approximate", nullable=False)
    review_status = Column(String, default="pending", nullable=False)
    review_notes = Column(Text)
    reviewer_id = Column(GUID(), ForeignKey("users.id"))
    reviewed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="sightings", foreign_keys=[user_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])
    species = relationship("Species", back_populates="sightings")
    verifications = relationship("Verification", back_populates="sighting")
    crawled_sources = relationship("CrawledSource", back_populates="sighting")
    saved_by = relationship("SavedLocation", back_populates="sighting")


class Verification(Base):
    __tablename__ = "verifications"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    sighting_id = Column(GUID(), ForeignKey("sightings.id"), nullable=False)
    verifier_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    confirmed = Column(Boolean, nullable=False)
    notes = Column(Text)
    verified_at = Column(DateTime, default=datetime.utcnow)

    sighting = relationship("Sighting", back_populates="verifications")
    verifier = relationship("User", back_populates="verifications")


class CrawledSource(Base):
    __tablename__ = "crawled_sources"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    sighting_id = Column(GUID(), ForeignKey("sightings.id"), nullable=True)
    source_name = Column(String, nullable=False)
    source_url = Column(String, nullable=False, unique=True)
    raw_data = Column(Text)
    crawled_at = Column(DateTime, default=datetime.utcnow)

    sighting = relationship("Sighting", back_populates="crawled_sources")


class SourceSync(Base):
    __tablename__ = "source_syncs"

    source_name = Column(String, primary_key=True)
    last_started_at = Column(DateTime)
    last_succeeded_at = Column(DateTime)
    last_result = Column(Text)
    last_error = Column(Text)


class GuideRequestVote(Base):
    __tablename__ = "guide_request_votes"
    __table_args__ = (
        UniqueConstraint("poll_key", "voter_hash", name="uq_guide_request_vote_poll_voter"),
        Index("ix_guide_request_vote_poll_choice", "poll_key", "choice_slug"),
    )

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    poll_key = Column(String(64), nullable=False)
    choice_slug = Column(String(80), nullable=False)
    voter_hash = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    last_seen_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    revoked_at = Column(DateTime)
    user_agent = Column(String(300))
    ip_hash = Column(String(64))

    user = relationship("User", back_populates="sessions")


class AccountToken(Base):
    __tablename__ = "account_tokens"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False, index=True)
    purpose = Column(String(30), nullable=False)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    consumed_at = Column(DateTime)

    user = relationship("User", back_populates="account_tokens")


class RateLimitEvent(Base):
    __tablename__ = "rate_limit_events"
    __table_args__ = (Index("ix_rate_limit_action_key_created", "action", "key_hash", "created_at"),)

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    action = Column(String(30), nullable=False)
    key_hash = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SavedLocation(Base):
    __tablename__ = "saved_locations"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False, index=True)
    sighting_id = Column(GUID(), ForeignKey("sightings.id", ondelete="CASCADE"), nullable=True)
    title = Column(String(120), nullable=False)
    notes = Column(Text)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="saved_locations")
    sighting = relationship("Sighting", back_populates="saved_by")


class CommunityFind(Base):
    __tablename__ = "community_finds"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    region = Column(String, nullable=False)
    species_name = Column(String)
    summary = Column(Text)
    photo_url = Column(String)
    contributor_name = Column(String)
    reviewed = Column(Boolean, default=False)
    published = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class CommunityEvent(Base):
    __tablename__ = "community_events"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    starts_on = Column(Date, nullable=False)
    location_name = Column(String, nullable=False)
    region = Column(String)
    description = Column(Text)
    organizer = Column(String)
    url = Column(String)
    published = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ForageClub(Base):
    __tablename__ = "forage_clubs"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    region = Column(String, nullable=False)
    description = Column(Text)
    contact_url = Column(String)
    meeting_cadence = Column(String)
    published = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ResourceGuide(Base):
    __tablename__ = "resource_guides"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    category = Column(String, nullable=False)
    summary = Column(Text)
    url = Column(String)
    priority = Column(Integer, default=100)
    published = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
