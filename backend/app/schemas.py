from datetime import date, datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class SpeciesRead(BaseModel):
    id: UUID
    common_name: str
    latin_name: str
    inaturalist_taxon_id: Optional[int] = None
    edibility: Optional[str] = None
    look_alikes: Optional[str] = None
    habitat_notes: Optional[str] = None
    peak_months: Optional[str] = None
    elevation_min_ft: Optional[int] = None
    elevation_max_ft: Optional[int] = None
    range_notes: Optional[str] = None
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


class GuideSpeciesSummary(BaseModel):
    species_id: UUID
    inaturalist_taxon_id: int
    recent_observations: int
    latest_observed_on: Optional[date] = None
    latest_photo_url: Optional[str] = None
    latest_photo_attribution: Optional[str] = None
    latest_source_url: Optional[str] = None


class GuideRequestOptionRead(BaseModel):
    slug: str
    common_name: str
    latin_name: str
    reason: str
    votes: int


class GuideRequestPollRead(BaseModel):
    poll_key: str
    question: str
    total_votes: int
    selection: Optional[str] = None
    options: list[GuideRequestOptionRead]


class GuideRequestVoteCreate(BaseModel):
    choice_slug: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9-]+$")


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
    weather_notes: Optional[str] = Field(default=None, max_length=240)
    place_name: Optional[str] = Field(default=None, max_length=160)
    notes: Optional[str] = Field(default=None, max_length=2000)
    photo_url: Optional[str] = Field(default=None, max_length=1000)
    photo_urls: list[str] = Field(default_factory=list, max_length=6)
    location_privacy: Literal["approximate", "exact", "private"] = "approximate"

    @field_validator("photo_urls")
    @classmethod
    def validate_photo_urls(cls, values):
        for value in values:
            if not value.startswith(("https://", "http://")) or len(value) > 1000:
                raise ValueError("Photo links must be valid http or https URLs")
        return list(dict.fromkeys(values))


class SightingUpdate(BaseModel):
    species_id: Optional[UUID] = None
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    elevation_ft: Optional[float] = Field(default=None, ge=-1500, le=30000)
    found_on: Optional[date] = None
    habitat_type: Optional[str] = Field(default=None, max_length=80)
    substrate: Optional[str] = Field(default=None, max_length=120)
    weather_notes: Optional[str] = Field(default=None, max_length=240)
    place_name: Optional[str] = Field(default=None, max_length=160)
    notes: Optional[str] = Field(default=None, max_length=2000)
    photo_url: Optional[str] = Field(default=None, max_length=1000)
    photo_urls: Optional[list[str]] = Field(default=None, max_length=6)
    location_privacy: Optional[Literal["approximate", "exact", "private"]] = None

    @model_validator(mode="after")
    def coordinates_move_together(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Latitude and longitude must be updated together")
        return self

    @field_validator("photo_urls")
    @classmethod
    def validate_photo_urls(cls, values):
        if values is None:
            return values
        for value in values:
            if not value.startswith(("https://", "http://")) or len(value) > 1000:
                raise ValueError("Photo links must be valid http or https URLs")
        return list(dict.fromkeys(values))


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
    weather_notes: Optional[str] = None
    place_name: Optional[str] = None
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


class ObservationPhotoRead(BaseModel):
    id: UUID
    url: str
    attribution: Optional[str] = None
    source_url: Optional[str] = None
    position: int

    model_config = {"from_attributes": True}


class VerificationChecks(BaseModel):
    conclusion: Literal["supports", "uncertain", "disagrees"] = "uncertain"
    confidence: Literal["uncertain", "likely", "confident"] = "likely"
    cap_checked: bool = False
    underside_checked: bool = False
    stem_checked: bool = False
    base_checked: bool = False
    interior_checked: bool = False
    substrate_checked: bool = False
    lookalikes_checked: bool = False
    notes: Optional[str] = Field(default=None, max_length=1200)

    @model_validator(mode="after")
    def require_evidence(self):
        checked = sum((
            self.cap_checked, self.underside_checked, self.stem_checked,
            self.base_checked, self.interior_checked, self.substrate_checked,
            self.lookalikes_checked,
        ))
        if self.conclusion == "supports" and checked < 3:
            raise ValueError("Supporting an identification requires at least three checked field marks")
        return self


class VerificationRead(VerificationChecks):
    id: UUID
    verified_at: datetime

    model_config = {"from_attributes": True}


class VerificationSummaryRead(BaseModel):
    total: int
    supports: int
    uncertain: int
    disagrees: int
    field_mark_coverage: dict[str, int]
    recent: list[VerificationRead]


class SightingRecordRead(SightingRead):
    photos: list[ObservationPhotoRead]
    source_url: Optional[str] = None
    source_attribution: Optional[str] = None
    verification: VerificationSummaryRead


class ReviewCreate(VerificationChecks):
    status: Literal["approved", "rejected"]


class SavedLocationCreate(BaseModel):
    sighting_id: Optional[UUID] = None
    title: str = Field(min_length=1, max_length=120)
    notes: Optional[str] = Field(default=None, max_length=1000)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    revisit_on: Optional[date] = None


class SavedLocationRead(SavedLocationCreate):
    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class SavedLocationUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    notes: Optional[str] = Field(default=None, max_length=1000)
    revisit_on: Optional[date] = None


class AlertSubscriptionCreate(BaseModel):
    kind: Literal["species", "region"]
    species_taxon_id: Optional[int] = Field(default=None, ge=1)
    region_slug: Optional[str] = Field(default=None, max_length=80, pattern=r"^[a-z0-9-]+$")

    @model_validator(mode="after")
    def one_target(self):
        if self.kind == "species" and not self.species_taxon_id:
            raise ValueError("Choose a species")
        if self.kind == "region" and not self.region_slug:
            raise ValueError("Choose a region")
        return self


class AlertSubscriptionUpdate(BaseModel):
    enabled: bool


class AlertSubscriptionRead(BaseModel):
    id: UUID
    kind: str
    target_key: str
    species_taxon_id: Optional[int] = None
    species_name: Optional[str] = None
    region_slug: Optional[str] = None
    region_name: Optional[str] = None
    enabled: bool
    created_at: datetime
    last_sent_at: Optional[datetime] = None


class RegionSummaryRead(BaseModel):
    slug: str
    name: str
    description: str
    bounds: tuple[float, float, float, float]
    center: tuple[float, float]
    hemisphere: str
    observations_90d: int
    observations_14d: int
    species_count: int
    latest_observed_on: Optional[date] = None


class OutlookSpeciesRead(BaseModel):
    species: SpeciesRead
    status: Literal["likely", "starting", "ending"]
    confidence: Literal["low", "medium", "high"]
    observations_14d: int
    observations_30d: int
    previous_30d: int
    latest_observed_on: Optional[date] = None


class RegionDetailRead(RegionSummaryRead):
    outlook: list[OutlookSpeciesRead]
    recent_observations: list[SightingRead]


class SeasonalityRead(BaseModel):
    key: str
    taxon_id: Optional[int] = None
    region_slug: Optional[str] = None
    hemisphere: Optional[str] = None
    counts: list[int]
    sample_size: int
    synced_at: datetime
    source: str


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


class CommunitySummaryRead(BaseModel):
    reviewed_observations: int
    species_count: int
    recent_observations: int
    latest_observed_on: Optional[date] = None
    last_synced_at: Optional[datetime] = None


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
