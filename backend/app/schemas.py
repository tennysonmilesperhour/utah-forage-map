from datetime import date, datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, model_validator


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


class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=40)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserRead(BaseModel):
    id: UUID
    username: str
    email: EmailStr
    role: str
    trust_level: int
    total_finds: int
    is_active: bool
    email_verified: bool
    joined_at: datetime

    model_config = {"from_attributes": True}


class EmailRequest(BaseModel):
    email: EmailStr


class TokenRequest(BaseModel):
    token: str = Field(min_length=20, max_length=300)


class PasswordResetConfirm(TokenRequest):
    password: str = Field(min_length=8, max_length=128)


class PasswordConfirm(BaseModel):
    password: str = Field(min_length=8, max_length=128)


class SessionRead(BaseModel):
    id: UUID
    created_at: datetime
    expires_at: datetime
    last_seen_at: datetime
    user_agent: Optional[str] = None
    current: bool = False


class SightingCreate(BaseModel):
    species_id: UUID
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    elevation_ft: Optional[float] = Field(default=None, ge=-1500, le=30000)
    found_on: Optional[date] = None
    month: Optional[int] = Field(default=None, ge=1, le=12)
    habitat_type: Optional[str] = Field(default=None, max_length=80)
    substrate: Optional[str] = Field(default=None, max_length=120)
    notes: Optional[str] = Field(default=None, max_length=2000)
    photo_url: Optional[str] = Field(default=None, max_length=1000)
    location_privacy: Literal["approximate", "exact", "private"] = "approximate"


class SightingUpdate(BaseModel):
    species_id: Optional[UUID] = None
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    elevation_ft: Optional[float] = Field(default=None, ge=-1500, le=30000)
    found_on: Optional[date] = None
    habitat_type: Optional[str] = Field(default=None, max_length=80)
    substrate: Optional[str] = Field(default=None, max_length=120)
    notes: Optional[str] = Field(default=None, max_length=2000)
    photo_url: Optional[str] = Field(default=None, max_length=1000)
    location_privacy: Optional[Literal["approximate", "exact", "private"]] = None

    @model_validator(mode="after")
    def coordinates_move_together(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Latitude and longitude must be updated together")
        return self


class SightingRead(BaseModel):
    id: UUID
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
    location_privacy: str
    review_status: str
    created_at: datetime
    species: SpeciesRead

    model_config = {"from_attributes": True}


class OwnerSightingRead(SightingRead):
    user_id: UUID
    review_notes: Optional[str] = None
    updated_at: datetime


class ReviewCreate(BaseModel):
    status: Literal["approved", "rejected"]
    notes: Optional[str] = Field(default=None, max_length=2000)


class SavedLocationCreate(BaseModel):
    sighting_id: Optional[UUID] = None
    title: str = Field(min_length=1, max_length=120)
    notes: Optional[str] = Field(default=None, max_length=1000)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class SavedLocationRead(SavedLocationCreate):
    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class VerificationCreate(BaseModel):
    sighting_id: UUID
    confirmed: bool
    notes: Optional[str] = None


class CommunityFindRead(BaseModel):
    id: UUID
    title: str
    region: str
    species_name: Optional[str] = None
    summary: Optional[str] = None
    photo_url: Optional[str] = None
    contributor_name: Optional[str] = None
    reviewed: bool
    published: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class CommunityEventRead(BaseModel):
    id: UUID
    title: str
    starts_on: date
    location_name: str
    region: Optional[str] = None
    description: Optional[str] = None
    organizer: Optional[str] = None
    url: Optional[str] = None
    published: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ForageClubRead(BaseModel):
    id: UUID
    name: str
    region: str
    description: Optional[str] = None
    contact_url: Optional[str] = None
    meeting_cadence: Optional[str] = None
    published: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ResourceGuideRead(BaseModel):
    id: UUID
    title: str
    category: str
    summary: Optional[str] = None
    url: Optional[str] = None
    priority: int
    published: bool
    created_at: datetime

    model_config = {"from_attributes": True}
