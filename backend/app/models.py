import uuid
from datetime import datetime, date
from sqlalchemy import (
    Boolean, Column, Date, DateTime, Float, ForeignKey,
    Integer, String, Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="user")
    trust_level = Column(Integer, default=0)
    total_finds = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    joined_at = Column(DateTime, default=datetime.utcnow)

    sightings = relationship("Sighting", back_populates="user", foreign_keys="Sighting.user_id")
    verifications = relationship("Verification", back_populates="verifier")


class Species(Base):
    __tablename__ = "species"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    common_name = Column(String, nullable=False)
    latin_name = Column(String, nullable=False)
    edibility = Column(String)
    look_alikes = Column(Text)
    habitat_notes = Column(Text)
    peak_months = Column(String)  # comma-separated ints e.g. "4,5,6"
    elevation_min_ft = Column(Integer)
    elevation_max_ft = Column(Integer)
    utah_regions = Column(String)
    notes = Column(Text)

    sightings = relationship("Sighting", back_populates="species")


class Sighting(Base):
    __tablename__ = "sightings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    species_id = Column(UUID(as_uuid=True), ForeignKey("species.id"), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    elevation_ft = Column(Float)
    found_on = Column(Date)
    month = Column(Integer)
    habitat_type = Column(String)
    substrate = Column(String)
    notes = Column(Text)
    photo_url = Column(String)
    source = Column(String, default="community")
    confidence_score = Column(Integer, default=50)
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="sightings", foreign_keys=[user_id])
    species = relationship("Species", back_populates="sightings")
    verifications = relationship("Verification", back_populates="sighting")
    crawled_sources = relationship("CrawledSource", back_populates="sighting")


class Verification(Base):
    __tablename__ = "verifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sighting_id = Column(UUID(as_uuid=True), ForeignKey("sightings.id"), nullable=False)
    verifier_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    confirmed = Column(Boolean, nullable=False)
    notes = Column(Text)
    verified_at = Column(DateTime, default=datetime.utcnow)

    sighting = relationship("Sighting", back_populates="verifications")
    verifier = relationship("User", back_populates="verifications")


class CrawledSource(Base):
    __tablename__ = "crawled_sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sighting_id = Column(UUID(as_uuid=True), ForeignKey("sightings.id"), nullable=True)
    source_name = Column(String, nullable=False)
    source_url = Column(String, nullable=False)
    raw_data = Column(Text)
    crawled_at = Column(DateTime, default=datetime.utcnow)

    sighting = relationship("Sighting", back_populates="crawled_sources")
