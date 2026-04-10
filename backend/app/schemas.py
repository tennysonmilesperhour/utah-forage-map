from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr


# ── Species ──────────────────────────────────────────────────────────────────

class SpeciesRead(BaseModel):
    id: UUID
    common_name: str
    latin_name: str
    edibility: Optional[str] = None
    look_alikes: Optional[str] = None
    habitat_notes: Optional[str] = None
    peak_months: Optional[str] = None
    elevation_min_ft: Optional[int] = None
    elevation_max_ft: Optional[int] = None
    utah_regions: Optional[str] = None
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


# ── User ─────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserRead(BaseModel):
    id: UUID
    username: str
    email: EmailStr
    role: str
    trust_level: int
    total_finds: int
    is_active: bool
    joined_at: datetime

    model_config = {"from_attributes": True}


# ── Sighting ──────────────────────────────────────────────────────────────────

class SightingCreate(BaseModel):
    species_id: UUID
    latitude: float
    longitude: float
    elevation_ft: Optional[float] = None
    found_on: Optional[date] = None
    month: Optional[int] = None
    habitat_type: Optional[str] = None
    substrate: Optional[str] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    source: str = "community"
    confidence_score: int = 50


class SightingRead(BaseModel):
    id: UUID
    user_id: UUID
    species_id: UUID
    latitude: float
    longitude: float
    elevation_ft: Optional[float] = None
    found_on: Optional[date] = None
    month: Optional[int] = None
    habitat_type: Optional[str] = None
    substrate: Optional[str] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    source: str
    confidence_score: int
    verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SightingFilter(BaseModel):
    species_id: Optional[UUID] = None
    month_min: Optional[int] = None
    month_max: Optional[int] = None
    elev_min: Optional[float] = None
    elev_max: Optional[float] = None
    habitat_type: Optional[str] = None
    source: Optional[str] = None
    verified_only: Optional[bool] = None


# ── Verification ──────────────────────────────────────────────────────────────

class VerificationCreate(BaseModel):
    sighting_id: UUID
    confirmed: bool
    notes: Optional[str] = None
