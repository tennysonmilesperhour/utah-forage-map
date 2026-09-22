"""Private journals with explicit public projections and revocable account grants."""

from datetime import date
from typing import Literal
from uuid import UUID, uuid4
import json
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    Float,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Session
from app.database import Base, get_db
from app.models import GUID, User

SIGNS = (
    "Aries",
    "Taurus",
    "Gemini",
    "Cancer",
    "Leo",
    "Virgo",
    "Libra",
    "Scorpio",
    "Sagittarius",
    "Capricorn",
    "Aquarius",
    "Pisces",
)
PLACEMENTS = (
    "Sun",
    "Moon",
    "Ascendant",
    "Mercury",
    "Venus",
    "Mars",
    "Jupiter",
    "Saturn",
    "Uranus",
    "Neptune",
    "Pluto",
)


class ForagerProfile(Base):
    __tablename__ = "forager_profiles"
    user_id = Column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    display_name = Column(String(100), nullable=False, default="")
    bio = Column(String(1000), nullable=False, default="")
    astrology_enabled = Column(Boolean, nullable=False, default=False)
    zodiac = Column(String(20), nullable=False, default="tropical")
    placements_json = Column(Text, nullable=False, default="{}")


class GatheringCollection(Base):
    __tablename__ = "gathering_collections"
    id = Column(GUID(), primary_key=True, default=uuid4)
    owner_id = Column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title = Column(String(120), nullable=False)
    visibility = Column(String(12), nullable=False, default="private")


class GatheringPlace(Base):
    __tablename__ = "gathering_places"
    id = Column(GUID(), primary_key=True, default=uuid4)
    collection_id = Column(
        GUID(),
        ForeignKey("gathering_collections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(120), nullable=False)
    plant = Column(String(120), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    notes = Column(Text, nullable=False, default="")
    visibility = Column(String(12), nullable=False, default="inherit")
    public_exact = Column(Boolean, nullable=False, default=False)
    public_history = Column(Boolean, nullable=False, default=False)


class GatheringHarvest(Base):
    __tablename__ = "gathering_harvests"
    id = Column(GUID(), primary_key=True, default=uuid4)
    place_id = Column(
        GUID(),
        ForeignKey("gathering_places.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    gathered_on = Column(Date, nullable=False)
    weight = Column(Float)
    unit = Column(String(8))
    percent_taken = Column(Float)
    available_basis = Column(String(240), nullable=False, default="")
    notes = Column(Text, nullable=False, default="")


class GatheringGrant(Base):
    __tablename__ = "gathering_grants"
    __table_args__ = (
        UniqueConstraint(
            "collection_id", "resource_key", "recipient_id", name="uq_gathering_grant"
        ),
    )
    id = Column(GUID(), primary_key=True, default=uuid4)
    collection_id = Column(
        GUID(),
        ForeignKey("gathering_collections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    resource_key = Column(String(36), nullable=False)
    recipient_id = Column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )


class Input(BaseModel):
    model_config = ConfigDict(
        extra="forbid", str_strip_whitespace=True, allow_inf_nan=False
    )


class ProfileInput(Input):
    display_name: str = Field(default="", max_length=100)
    bio: str = Field(default="", max_length=1000)
    astrology_enabled: bool = False
    zodiac: Literal["tropical", "sidereal"] = "tropical"
    placements: dict[str, str] = Field(default_factory=dict)

    @model_validator(mode="after")
    def chart(self):
        if any(
            k not in PLACEMENTS or v not in SIGNS for k, v in self.placements.items()
        ):
            raise ValueError("Choose a supported placement and sign")
        return self


class CollectionInput(Input):
    title: str = Field(min_length=1, max_length=120)
    visibility: Literal["private", "public"] = "private"


class PlaceInput(Input):
    title: str = Field(min_length=1, max_length=120)
    plant: str = Field(min_length=1, max_length=120)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    notes: str = Field(default="", max_length=5000)
    visibility: Literal["inherit", "private", "public"] = "inherit"
    public_exact: bool = False
    public_history: bool = False


class HarvestInput(Input):
    gathered_on: date
    weight: float | None = Field(default=None, gt=0, le=1000000)
    unit: Literal["g", "kg", "oz", "lb"] | None = None
    percent_taken: float | None = Field(default=None, gt=0, le=100)
    available_basis: str = Field(default="", max_length=240)
    notes: str = Field(default="", max_length=5000)

    @model_validator(mode="after")
    def quantities(self):
        if self.gathered_on > date.today():
            raise ValueError("Harvest date cannot be in the future")
        if (self.weight is None) != (self.unit is None):
            raise ValueError("Provide weight and unit together")
        if self.weight is None and self.percent_taken is None:
            raise ValueError("Record weight, percentage, or both")
        if self.percent_taken is not None and not self.available_basis:
            raise ValueError("Describe the basis for your percentage estimate")
        return self


class GrantInput(Input):
    username: str = Field(min_length=1, max_length=120)
    place_id: UUID | None = None


def record(row):
    return {c.name: getattr(row, c.name) for c in row.__table__.columns}


def remove_collection(db, c):
    ids = [p.id for p in db.query(GatheringPlace).filter_by(collection_id=c.id)]
    db.query(GatheringHarvest).filter(GatheringHarvest.place_id.in_(ids)).delete(
        synchronize_session=False
    )
    db.query(GatheringGrant).filter_by(collection_id=c.id).delete()
    db.query(GatheringPlace).filter_by(collection_id=c.id).delete()
    db.delete(c)


def remove_user_journal(db, uid):
    for c in db.query(GatheringCollection).filter_by(owner_id=uid).all():
        remove_collection(db, c)
    db.query(GatheringGrant).filter_by(recipient_id=uid).delete()
    db.query(ForagerProfile).filter_by(user_id=uid).delete()


def journal_router(current_user):
    router = APIRouter(prefix="/api")

    def owned_collection(db, cid, user):
        c = db.query(GatheringCollection).filter_by(id=cid, owner_id=user.id).first()
        if not c:
            raise HTTPException(404, "Collection not found")
        return c

    def owned_place(db, pid, user):
        p = db.get(GatheringPlace, pid)
        if not p:
            raise HTTPException(404, "Place not found")
        owned_collection(db, p.collection_id, user)
        return p

    def project(db, c, owner=False, grants=()):
        places = []
        for p in (
            db.query(GatheringPlace)
            .filter_by(collection_id=c.id)
            .order_by(GatheringPlace.title)
        ):
            privileged = (
                owner
                or str(p.id) in grants
                or ("all" in grants and p.visibility != "private")
            )
            public = p.visibility == "public" or (
                p.visibility == "inherit" and c.visibility == "public"
            )
            if not privileged and not public:
                continue
            fields = (
                record(p)
                if privileged
                else {k: getattr(p, k) for k in ("id", "title", "plant")}
            )
            if not privileged and p.public_exact:
                fields.update(latitude=p.latitude, longitude=p.longitude)
            fields["access"] = (
                "owner" if owner else "invited" if privileged else "public"
            )
            fields["harvests"] = []
            if privileged or p.public_history:
                for h in (
                    db.query(GatheringHarvest)
                    .filter_by(place_id=p.id)
                    .order_by(GatheringHarvest.gathered_on.desc())
                ):
                    fields["harvests"].append(
                        record(h)
                        if privileged
                        else {
                            k: getattr(h, k)
                            for k in (
                                "id",
                                "gathered_on",
                                "weight",
                                "unit",
                                "percent_taken",
                            )
                        }
                    )
            places.append(fields)
        return dict(
            id=c.id,
            title=(
                c.title
                if owner or "all" in grants or c.visibility == "public"
                else "Shared gathering places"
            ),
            visibility=c.visibility,
            access="owner" if owner else "reader",
            places=places,
        )

    @router.get("/account/profile")
    def profile(
        response: Response, user=Depends(current_user), db: Session = Depends(get_db)
    ):
        response.headers["Cache-Control"] = "private, no-store"
        p = db.get(ForagerProfile, user.id)
        return (
            dict(
                display_name=p.display_name,
                bio=p.bio,
                astrology_enabled=p.astrology_enabled,
                zodiac=p.zodiac,
                placements=json.loads(p.placements_json),
            )
            if p
            else ProfileInput(display_name=user.username).model_dump()
        )

    @router.put("/account/profile")
    def save_profile(
        payload: ProfileInput, user=Depends(current_user), db: Session = Depends(get_db)
    ):
        p = db.get(ForagerProfile, user.id) or ForagerProfile(user_id=user.id)
        for k, v in payload.model_dump(exclude={"placements"}).items():
            setattr(p, k, v)
        p.placements_json = json.dumps(payload.placements)
        db.add(p)
        db.commit()
        return payload

    @router.get("/account/collections")
    def collections(
        response: Response, user=Depends(current_user), db: Session = Depends(get_db)
    ):
        response.headers["Cache-Control"] = "private, no-store"
        result = [
            project(db, c, owner=True)
            for c in db.query(GatheringCollection)
            .filter_by(owner_id=user.id)
            .order_by(GatheringCollection.title)
        ]
        grants = db.query(GatheringGrant).filter_by(recipient_id=user.id).all()
        for cid in {g.collection_id for g in grants}:
            c = db.get(GatheringCollection, cid)
            if c and c.owner_id != user.id:
                result.append(
                    project(
                        db,
                        c,
                        grants=[
                            g.resource_key for g in grants if g.collection_id == cid
                        ],
                    )
                )
        return result

    @router.post("/account/collections", status_code=201)
    def create_collection(
        payload: CollectionInput,
        user=Depends(current_user),
        db: Session = Depends(get_db),
    ):
        c = GatheringCollection(owner_id=user.id, **payload.model_dump())
        db.add(c)
        db.commit()
        db.refresh(c)
        return project(db, c, owner=True)

    @router.put("/account/collections/{cid}")
    def update_collection(
        cid: UUID,
        payload: CollectionInput,
        user=Depends(current_user),
        db: Session = Depends(get_db),
    ):
        c = owned_collection(db, cid, user)
        for k, v in payload.model_dump().items():
            setattr(c, k, v)
        db.commit()
        return project(db, c, owner=True)

    @router.delete("/account/collections/{cid}", status_code=204)
    def delete_collection(
        cid: UUID, user=Depends(current_user), db: Session = Depends(get_db)
    ):
        remove_collection(db, owned_collection(db, cid, user))
        db.commit()

    @router.post("/account/collections/{cid}/places", status_code=201)
    def create_place(
        cid: UUID,
        payload: PlaceInput,
        user=Depends(current_user),
        db: Session = Depends(get_db),
    ):
        owned_collection(db, cid, user)
        p = GatheringPlace(collection_id=cid, **payload.model_dump())
        db.add(p)
        db.commit()
        db.refresh(p)
        return record(p)

    @router.put("/account/places/{pid}")
    def update_place(
        pid: UUID,
        payload: PlaceInput,
        user=Depends(current_user),
        db: Session = Depends(get_db),
    ):
        p = owned_place(db, pid, user)
        for k, v in payload.model_dump().items():
            setattr(p, k, v)
        db.commit()
        return record(p)

    @router.delete("/account/places/{pid}", status_code=204)
    def delete_place(
        pid: UUID, user=Depends(current_user), db: Session = Depends(get_db)
    ):
        p = owned_place(db, pid, user)
        db.query(GatheringHarvest).filter_by(place_id=pid).delete()
        db.query(GatheringGrant).filter_by(
            collection_id=p.collection_id, resource_key=str(pid)
        ).delete()
        db.delete(p)
        db.commit()

    @router.post("/account/places/{pid}/harvests", status_code=201)
    def harvest(
        pid: UUID,
        payload: HarvestInput,
        user=Depends(current_user),
        db: Session = Depends(get_db),
    ):
        owned_place(db, pid, user)
        h = GatheringHarvest(place_id=pid, **payload.model_dump())
        db.add(h)
        db.commit()
        db.refresh(h)
        return record(h)

    @router.put("/account/harvests/{hid}")
    def edit_harvest(
        hid: UUID,
        payload: HarvestInput,
        user=Depends(current_user),
        db: Session = Depends(get_db),
    ):
        h = db.get(GatheringHarvest, hid)
        if not h:
            raise HTTPException(404, "Harvest not found")
        owned_place(db, h.place_id, user)
        for k, v in payload.model_dump().items():
            setattr(h, k, v)
        db.commit()
        return record(h)

    @router.delete("/account/harvests/{hid}", status_code=204)
    def delete_harvest(
        hid: UUID, user=Depends(current_user), db: Session = Depends(get_db)
    ):
        h = db.get(GatheringHarvest, hid)
        if not h:
            raise HTTPException(404, "Harvest not found")
        owned_place(db, h.place_id, user)
        db.delete(h)
        db.commit()

    @router.get("/account/collections/{cid}/grants")
    def grants(
        cid: UUID,
        response: Response,
        user=Depends(current_user),
        db: Session = Depends(get_db),
    ):
        response.headers["Cache-Control"] = "private, no-store"
        owned_collection(db, cid, user)
        return [
            dict(
                id=g.id,
                resource_key=g.resource_key,
                username=db.get(User, g.recipient_id).username,
            )
            for g in db.query(GatheringGrant).filter_by(collection_id=cid)
        ]

    @router.post("/account/collections/{cid}/grants", status_code=201)
    def grant(
        cid: UUID,
        payload: GrantInput,
        user=Depends(current_user),
        db: Session = Depends(get_db),
    ):
        owned_collection(db, cid, user)
        if (
            payload.place_id
            and owned_place(db, payload.place_id, user).collection_id != cid
        ):
            raise HTTPException(404, "Place not found")
        recipient = (
            db.query(User).filter_by(username=payload.username, is_active=True).first()
        )
        if not recipient:
            raise HTTPException(400, "No active account with that username")
        if recipient.id == user.id:
            raise HTTPException(400, "You already own this collection")
        key = str(payload.place_id) if payload.place_id else "all"
        g = (
            db.query(GatheringGrant)
            .filter_by(collection_id=cid, resource_key=key, recipient_id=recipient.id)
            .first()
        )
        if not g:
            g = GatheringGrant(
                collection_id=cid, resource_key=key, recipient_id=recipient.id
            )
            db.add(g)
            db.commit()
            db.refresh(g)
        return {"id": g.id}

    @router.delete("/account/grants/{gid}", status_code=204)
    def revoke(gid: UUID, user=Depends(current_user), db: Session = Depends(get_db)):
        g = db.get(GatheringGrant, gid)
        if not g:
            raise HTTPException(404, "Access grant not found")
        owned_collection(db, g.collection_id, user)
        db.delete(g)
        db.commit()

    @router.get("/collections/{cid}/public")
    def public_collection(cid: UUID, response: Response, db: Session = Depends(get_db)):
        response.headers["Cache-Control"] = "no-store"
        c = db.get(GatheringCollection, cid)
        if not c:
            raise HTTPException(404, "Collection not found")
        result = project(db, c)
        if c.visibility != "public" and not result["places"]:
            raise HTTPException(404, "Collection not found")
        return result

    return router
