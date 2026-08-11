from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app.models import CommunityEvent, CommunityFind, ForageClub, ResourceGuide, Sighting, Species, User
from app.schemas import (
    CommunityEventRead,
    CommunityFindRead,
    ForageClubRead,
    ResourceGuideRead,
    SightingCreate,
    SightingRead,
    SpeciesRead,
)

app = FastAPI(title="Utah Forage Map API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def create_dev_tables():
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok", "project": "utah-forage-map"}


@app.get("/api/species", response_model=list[SpeciesRead])
def list_species(db: Session = Depends(get_db)):
    return db.query(Species).all()


@app.get("/api/community/finds", response_model=list[CommunityFindRead])
def list_community_finds(limit: int = Query(6, le=50), db: Session = Depends(get_db)):
    return (
        db.query(CommunityFind)
        .filter(CommunityFind.published == True)
        .order_by(CommunityFind.reviewed.desc(), CommunityFind.created_at.desc())
        .limit(limit)
        .all()
    )


@app.get("/api/community/events", response_model=list[CommunityEventRead])
def list_community_events(limit: int = Query(6, le=50), db: Session = Depends(get_db)):
    return (
        db.query(CommunityEvent)
        .filter(CommunityEvent.published == True)
        .order_by(CommunityEvent.starts_on.asc())
        .limit(limit)
        .all()
    )


@app.get("/api/community/clubs", response_model=list[ForageClubRead])
def list_forage_clubs(limit: int = Query(6, le=50), db: Session = Depends(get_db)):
    return (
        db.query(ForageClub)
        .filter(ForageClub.published == True)
        .order_by(ForageClub.region.asc(), ForageClub.name.asc())
        .limit(limit)
        .all()
    )


@app.get("/api/resources", response_model=list[ResourceGuideRead])
def list_resource_guides(limit: int = Query(8, le=50), db: Session = Depends(get_db)):
    return (
        db.query(ResourceGuide)
        .filter(ResourceGuide.published == True)
        .order_by(ResourceGuide.priority.asc(), ResourceGuide.title.asc())
        .limit(limit)
        .all()
    )


@app.get("/api/sightings", response_model=list[SightingRead])
def list_sightings(
    species_id: Optional[str] = Query(None),
    month_min: Optional[int] = Query(None, ge=1, le=12),
    month_max: Optional[int] = Query(None, ge=1, le=12),
    elev_min: Optional[float] = Query(None),
    elev_max: Optional[float] = Query(None),
    habitat_type: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    verified_only: Optional[bool] = Query(None),
    limit: int = Query(500, le=2000),
    db: Session = Depends(get_db),
):
    q = db.query(Sighting)

    if species_id:
        q = q.filter(Sighting.species_id == species_id)
    if month_min is not None:
        q = q.filter(Sighting.month >= month_min)
    if month_max is not None:
        q = q.filter(Sighting.month <= month_max)
    if elev_min is not None:
        q = q.filter(Sighting.elevation_ft >= elev_min)
    if elev_max is not None:
        q = q.filter(Sighting.elevation_ft <= elev_max)
    if habitat_type:
        q = q.filter(Sighting.habitat_type == habitat_type)
    if source:
        q = q.filter(Sighting.source == source)
    if verified_only:
        q = q.filter(Sighting.verified == True)

    return q.limit(limit).all()


@app.post("/api/sightings", response_model=SightingRead, status_code=201)
def create_sighting(payload: SightingCreate, db: Session = Depends(get_db)):
    species = db.get(Species, payload.species_id)
    if species is None:
        raise HTTPException(status_code=404, detail="Species not found")

    user = db.query(User).filter(User.username == "community").one_or_none()
    if user is None:
        user = User(
            username="community",
            email="community@utah-forage-map.local",
            hashed_password="not-used",
            role="system",
        )
        db.add(user)
        db.flush()

    data = payload.model_dump(exclude={"month"})
    month = payload.month or (payload.found_on.month if payload.found_on else None)
    sighting = Sighting(**data, user_id=user.id, month=month)
    db.add(sighting)
    user.total_finds += 1
    db.commit()
    db.refresh(sighting)
    return sighting
