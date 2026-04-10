from typing import Optional
from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Sighting, Species
from app.schemas import SightingRead, SpeciesRead

app = FastAPI(title="Utah Forage Map API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "project": "utah-forage-map"}


@app.get("/api/species", response_model=list[SpeciesRead])
def list_species(db: Session = Depends(get_db)):
    return db.query(Species).all()


@app.get("/api/sightings", response_model=list[SightingRead])
def list_sightings(
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
