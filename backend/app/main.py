from dataclasses import dataclass
import math
from datetime import date, datetime, timedelta
import os
from typing import Optional
from uuid import UUID

from fastapi import BackgroundTasks, Cookie, Depends, FastAPI, Header, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.database import Base, engine, get_db
from app.email_service import send_account_email
from app.models import (
    AccountToken, CommunityEvent, CommunityFind, ForageClub, RateLimitEvent,
    ResourceGuide, SavedLocation, Sighting, SourceSync, Species, User, UserSession,
)
from app.privacy import MAX_OFFSET_MILES, MILES_PER_DEGREE, normalize_longitude, public_sighting
from app.schemas import (
    CommunityEventRead, CommunityFindRead, CommunitySummaryRead, EmailRequest, ForageClubRead,
    OwnerSightingRead, PasswordConfirm, PasswordResetConfirm, ResourceGuideRead,
    ReviewCreate, SavedLocationCreate, SavedLocationRead, SessionRead,
    SightingCreate, SightingRead, SightingUpdate, SpeciesRead, TokenRequest,
    UserCreate, UserLogin, UserRead,
)
from app.security import DEFAULT_SECRET_KEY, SECRET_KEY, hash_identifier, hash_token, new_token, passwords


app = FastAPI(title="Mushroom Forage Map API")
SESSION_COOKIE = "ufm_session"
SESSION_DAYS = int(os.getenv("SESSION_DAYS", "30"))
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
ADMIN_EMAILS = {value.strip().lower() for value in os.getenv("ADMIN_EMAILS", "").split(",") if value.strip()}
CRON_SECRET = os.getenv("CRON_SECRET")

if ENVIRONMENT == "production" and SECRET_KEY == DEFAULT_SECRET_KEY:
    raise RuntimeError("SECRET_KEY must be set in production")

allowed_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
allowed_origins.extend(value.strip() for value in os.getenv("CORS_ORIGINS", "").split(",") if value.strip())
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


@app.on_event("startup")
def create_dev_tables():
    if ENVIRONMENT != "production":
        Base.metadata.create_all(bind=engine)


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.query(User.id).limit(1).all()
    return {"status": "ok", "project": "mushroom-forage-map", "email_configured": bool(os.getenv("RESEND_API_KEY"))}


def now() -> datetime:
    return datetime.utcnow()


def request_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    return forwarded.split(",")[0].strip() or (request.client.host if request.client else "unknown")


def enforce_rate_limit(db: Session, action: str, identifier: str, limit: int, minutes: int):
    key = hash_identifier(identifier.lower())
    cutoff = now() - timedelta(minutes=minutes)
    count = db.query(RateLimitEvent).filter(
        RateLimitEvent.action == action,
        RateLimitEvent.key_hash == key,
        RateLimitEvent.created_at >= cutoff,
    ).count()
    if count >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please wait and try again.",
            headers={"Retry-After": str(minutes * 60)},
        )
    db.add(RateLimitEvent(action=action, key_hash=key))
    db.flush()


def create_session(db: Session, user: User, request: Request) -> str:
    token = new_token()
    db.add(UserSession(
        user_id=user.id,
        token_hash=hash_token(token),
        expires_at=now() + timedelta(days=SESSION_DAYS),
        user_agent=request.headers.get("user-agent", "")[:300],
        ip_hash=hash_identifier(request_ip(request)),
    ))
    return token


def set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=ENVIRONMENT == "production",
        samesite="lax",
        path="/",
    )


@dataclass
class AuthContext:
    user: User
    session: UserSession


def get_current_auth(
    session_token: Optional[str] = Cookie(None, alias=SESSION_COOKIE),
    db: Session = Depends(get_db),
) -> AuthContext:
    if not session_token:
        raise HTTPException(status_code=401, detail="Sign in required")
    session = db.query(UserSession).filter(UserSession.token_hash == hash_token(session_token)).one_or_none()
    if session is None or session.revoked_at is not None or session.expires_at <= now():
        raise HTTPException(status_code=401, detail="Session expired")
    user = db.get(User, session.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Account unavailable")
    if session.last_seen_at < now() - timedelta(minutes=15):
        session.last_seen_at = now()
        db.commit()
    return AuthContext(user=user, session=session)


def get_current_user(auth: AuthContext = Depends(get_current_auth)) -> User:
    return auth.user


def require_moderator(user: User = Depends(get_current_user)) -> User:
    if user.role not in {"moderator", "admin"} or not user.email_verified:
        raise HTTPException(status_code=403, detail="Moderator access required")
    return user


def issue_account_token(db: Session, user: User, purpose: str, hours: int) -> str:
    db.query(AccountToken).filter(
        AccountToken.user_id == user.id,
        AccountToken.purpose == purpose,
        AccountToken.consumed_at.is_(None),
    ).update({"consumed_at": now()})
    token = new_token()
    db.add(AccountToken(
        user_id=user.id,
        purpose=purpose,
        token_hash=hash_token(token),
        expires_at=now() + timedelta(hours=hours),
    ))
    return token


def consume_account_token(db: Session, token: str, purpose: str) -> AccountToken:
    record = db.query(AccountToken).filter(
        AccountToken.token_hash == hash_token(token), AccountToken.purpose == purpose
    ).one_or_none()
    if record is None or record.consumed_at is not None or record.expires_at <= now():
        raise HTTPException(status_code=400, detail="This account link is invalid or expired")
    record.consumed_at = now()
    return record


@app.post("/api/auth/register", response_model=UserRead, status_code=201)
def register(
    payload: UserCreate,
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    username = payload.username.strip()
    email = payload.email.lower()
    enforce_rate_limit(db, "register", request_ip(request), 5, 60)
    if len(username) < 2:
        raise HTTPException(status_code=422, detail="Display name must contain at least 2 characters")
    existing = db.query(User).filter(
        or_(func.lower(User.email) == email, func.lower(User.username) == username.lower())
    ).first()
    if existing:
        db.commit()
        raise HTTPException(status_code=409, detail="That email or display name is already in use")

    user = User(
        username=username,
        email=email,
        hashed_password=passwords.hash(payload.password),
        role="user",
    )
    db.add(user)
    db.flush()
    verification_token = issue_account_token(db, user, "verify_email", 24)
    session_token = create_session(db, user, request)
    db.commit()
    db.refresh(user)
    set_session_cookie(response, session_token)
    background_tasks.add_task(
        send_account_email,
        user.email,
        "Verify your Mushroom Forage Map email",
        "Verify your field account",
        "Confirm this email so you can always recover your logbook.",
        "Verify email",
        f"/?verify={verification_token}",
    )
    return user


@app.post("/api/auth/login", response_model=UserRead)
def login(payload: UserLogin, request: Request, response: Response, db: Session = Depends(get_db)):
    email = payload.email.lower()
    enforce_rate_limit(db, "login", f"{request_ip(request)}:{email}", 10, 15)
    user = db.query(User).filter(func.lower(User.email) == email).one_or_none()
    password_valid = False
    if user is not None:
        try:
            password_valid = passwords.verify(payload.password, user.hashed_password)
        except ValueError:
            password_valid = False
    if user is None or not password_valid or not user.is_active:
        db.commit()
        raise HTTPException(status_code=401, detail="Email or password is incorrect")

    session_token = create_session(db, user, request)
    db.commit()
    set_session_cookie(response, session_token)
    return user


@app.post("/api/auth/logout", status_code=204)
def logout(
    response: Response,
    session_token: Optional[str] = Cookie(None, alias=SESSION_COOKIE),
    db: Session = Depends(get_db),
):
    if session_token:
        session = db.query(UserSession).filter(UserSession.token_hash == hash_token(session_token)).one_or_none()
        if session and session.revoked_at is None:
            session.revoked_at = now()
            db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/", samesite="lax")


@app.get("/api/auth/me", response_model=UserRead)
def current_account(user: User = Depends(get_current_user)):
    return user


@app.post("/api/auth/verify-email", response_model=UserRead)
def verify_email(payload: TokenRequest, db: Session = Depends(get_db)):
    record = consume_account_token(db, payload.token, "verify_email")
    user = db.get(User, record.user_id)
    user.email_verified = True
    user.email_verified_at = now()
    if user.email.lower() in ADMIN_EMAILS:
        user.role = "admin"
    db.commit()
    db.refresh(user)
    return user


@app.post("/api/auth/verification/resend", status_code=202)
def resend_verification(
    request: Request,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.email_verified:
        return {"message": "Email already verified"}
    enforce_rate_limit(db, "verify", f"{request_ip(request)}:{user.email}", 3, 60)
    token = issue_account_token(db, user, "verify_email", 24)
    db.commit()
    background_tasks.add_task(
        send_account_email,
        user.email,
        "Verify your Mushroom Forage Map email",
        "Verify your field account",
        "Confirm this email so you can always recover your logbook.",
        "Verify email",
        f"/?verify={token}",
    )
    return {"message": "Verification email requested"}


@app.post("/api/auth/password/forgot", status_code=202)
def forgot_password(
    payload: EmailRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    email = payload.email.lower()
    enforce_rate_limit(db, "password_reset", f"{request_ip(request)}:{email}", 5, 60)
    user = db.query(User).filter(func.lower(User.email) == email, User.is_active == True).one_or_none()
    if user:
        token = issue_account_token(db, user, "reset_password", 1)
        db.commit()
        background_tasks.add_task(
            send_account_email,
            user.email,
            "Reset your Mushroom Forage Map password",
            "Reset your password",
            "Use this link to choose a new password for your field account.",
            "Reset password",
            f"/?reset={token}",
        )
    else:
        db.commit()
    return {"message": "If that account exists, a reset email has been sent"}


@app.post("/api/auth/password/reset", status_code=204)
def reset_password(payload: PasswordResetConfirm, db: Session = Depends(get_db)):
    record = consume_account_token(db, payload.token, "reset_password")
    user = db.get(User, record.user_id)
    user.hashed_password = passwords.hash(payload.password)
    db.query(UserSession).filter(
        UserSession.user_id == user.id, UserSession.revoked_at.is_(None)
    ).update({"revoked_at": now()})
    db.commit()


@app.get("/api/account/sessions", response_model=list[SessionRead])
def list_sessions(auth: AuthContext = Depends(get_current_auth), db: Session = Depends(get_db)):
    sessions = db.query(UserSession).filter(
        UserSession.user_id == auth.user.id,
        UserSession.revoked_at.is_(None),
        UserSession.expires_at > now(),
    ).order_by(UserSession.last_seen_at.desc()).all()
    return [SessionRead(
        id=item.id,
        created_at=item.created_at,
        expires_at=item.expires_at,
        last_seen_at=item.last_seen_at,
        user_agent=item.user_agent,
        current=item.id == auth.session.id,
    ) for item in sessions]


@app.delete("/api/account/sessions/{session_id}", status_code=204)
def revoke_session(
    session_id: UUID,
    auth: AuthContext = Depends(get_current_auth),
    db: Session = Depends(get_db),
):
    session = db.get(UserSession, session_id)
    if session is None or session.user_id != auth.user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    session.revoked_at = now()
    db.commit()


@app.post("/api/account/sessions/revoke-others", status_code=204)
def revoke_other_sessions(auth: AuthContext = Depends(get_current_auth), db: Session = Depends(get_db)):
    db.query(UserSession).filter(
        UserSession.user_id == auth.user.id,
        UserSession.id != auth.session.id,
        UserSession.revoked_at.is_(None),
    ).update({"revoked_at": now()})
    db.commit()


@app.delete("/api/account", status_code=204)
def delete_account(
    payload: PasswordConfirm,
    response: Response,
    auth: AuthContext = Depends(get_current_auth),
    db: Session = Depends(get_db),
):
    if not passwords.verify(payload.password, auth.user.hashed_password):
        raise HTTPException(status_code=400, detail="Password is incorrect")
    stamp = now().strftime("%Y%m%d%H%M%S")
    auth.user.username = f"Deleted forager {str(auth.user.id)[:8]}"
    auth.user.email = f"deleted-{auth.user.id}-{stamp}@invalid.local"
    auth.user.hashed_password = passwords.hash(new_token())
    auth.user.is_active = False
    auth.user.deleted_at = now()
    db.query(UserSession).filter(UserSession.user_id == auth.user.id).update({"revoked_at": now()})
    db.query(AccountToken).filter(AccountToken.user_id == auth.user.id).delete()
    db.query(SavedLocation).filter(SavedLocation.user_id == auth.user.id).delete()
    db.query(Sighting).filter(
        Sighting.user_id == auth.user.id,
        or_(Sighting.location_privacy == "private", Sighting.review_status != "approved"),
    ).delete(synchronize_session=False)
    db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/", samesite="lax")


@app.get("/api/species", response_model=list[SpeciesRead])
def list_species(db: Session = Depends(get_db)):
    return db.query(Species).order_by(Species.common_name.asc()).all()


@app.get("/api/community/finds", response_model=list[CommunityFindRead])
def list_community_finds(limit: int = Query(6, le=50), db: Session = Depends(get_db)):
    return db.query(CommunityFind).filter(CommunityFind.published == True).order_by(
        CommunityFind.reviewed.desc(), CommunityFind.created_at.desc()
    ).limit(limit).all()


@app.get("/api/community/events", response_model=list[CommunityEventRead])
def list_community_events(limit: int = Query(6, le=50), db: Session = Depends(get_db)):
    return db.query(CommunityEvent).filter(
        CommunityEvent.published == True, CommunityEvent.starts_on >= date.today()
    ).order_by(
        CommunityEvent.starts_on.asc()
    ).limit(limit).all()


@app.get("/api/community/clubs", response_model=list[ForageClubRead])
def list_forage_clubs(limit: int = Query(6, le=50), db: Session = Depends(get_db)):
    return db.query(ForageClub).filter(ForageClub.published == True).order_by(
        ForageClub.region.asc(), ForageClub.name.asc()
    ).limit(limit).all()


@app.get("/api/resources", response_model=list[ResourceGuideRead])
def list_resource_guides(limit: int = Query(8, le=50), db: Session = Depends(get_db)):
    return db.query(ResourceGuide).filter(ResourceGuide.published == True).order_by(
        ResourceGuide.priority.asc(), ResourceGuide.title.asc()
    ).limit(limit).all()


@app.get("/api/community/activity", response_model=list[SightingRead])
def list_community_activity(limit: int = Query(12, ge=1, le=50), db: Session = Depends(get_db)):
    sightings = db.query(Sighting).options(joinedload(Sighting.species)).filter(
        Sighting.review_status == "approved",
        Sighting.verified == True,
        Sighting.location_privacy != "private",
        Sighting.found_on.is_not(None),
    ).order_by(
        Sighting.found_on.desc(), Sighting.created_at.desc()
    ).limit(limit).all()
    return [public_sighting(item) for item in sightings]


@app.get("/api/community/summary", response_model=CommunitySummaryRead)
def community_summary(db: Session = Depends(get_db)):
    public_filters = (
        Sighting.review_status == "approved",
        Sighting.verified == True,
        Sighting.location_privacy != "private",
    )
    recent_cutoff = date.today() - timedelta(days=90)
    reviewed_observations = db.query(func.count(Sighting.id)).filter(*public_filters).scalar() or 0
    species_count = db.query(func.count(func.distinct(Sighting.species_id))).filter(*public_filters).scalar() or 0
    recent_observations = db.query(func.count(Sighting.id)).filter(
        *public_filters, Sighting.found_on >= recent_cutoff
    ).scalar() or 0
    latest_observed_on = db.query(func.max(Sighting.found_on)).filter(*public_filters).scalar()
    last_synced_at = db.query(func.max(SourceSync.last_succeeded_at)).scalar()
    return {
        "reviewed_observations": reviewed_observations,
        "species_count": species_count,
        "recent_observations": recent_observations,
        "latest_observed_on": latest_observed_on,
        "last_synced_at": last_synced_at,
    }


@app.get("/api/sightings", response_model=list[SightingRead])
def list_sightings(
    species_id: Optional[str] = Query(None),
    month_min: Optional[int] = Query(None, ge=1, le=12),
    month_max: Optional[int] = Query(None, ge=1, le=12),
    elev_min: Optional[float] = Query(None),
    elev_max: Optional[float] = Query(None),
    habitat_type: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    place: Optional[str] = Query(None, max_length=120),
    edibility_group: Optional[str] = Query(None, pattern="^(edible|hazard)$"),
    verified_only: Optional[bool] = Query(None),
    found_after: Optional[date] = Query(None),
    west: Optional[float] = Query(None, ge=-180, le=180),
    south: Optional[float] = Query(None, ge=-90, le=90),
    east: Optional[float] = Query(None, ge=-180, le=180),
    north: Optional[float] = Query(None, ge=-90, le=90),
    limit: int = Query(2000, le=4000),
    db: Session = Depends(get_db),
):
    query = db.query(Sighting).options(joinedload(Sighting.species)).filter(
        Sighting.review_status == "approved", Sighting.location_privacy != "private"
    )
    if species_id:
        query = query.filter(Sighting.species_id == species_id)
    if month_min is not None and month_max is not None:
        if month_min <= month_max:
            query = query.filter(Sighting.month.between(month_min, month_max))
        else:
            query = query.filter(or_(Sighting.month >= month_min, Sighting.month <= month_max))
    elif month_min is not None:
        query = query.filter(Sighting.month >= month_min)
    elif month_max is not None:
        query = query.filter(Sighting.month <= month_max)
    if elev_min is not None:
        query = query.filter(Sighting.elevation_ft >= elev_min)
    if elev_max is not None:
        query = query.filter(Sighting.elevation_ft <= elev_max)
    if habitat_type:
        query = query.filter(Sighting.habitat_type == habitat_type)
    if source:
        query = query.filter(Sighting.source == source)
    if place:
        query = query.filter(Sighting.place_name.ilike(f"%{place.strip()}%"))
    if edibility_group:
        values = {"edible", "choice"} if edibility_group == "edible" else {"poisonous", "deadly"}
        query = query.join(Sighting.species).filter(Species.edibility.in_(values))
    if verified_only:
        query = query.filter(Sighting.verified == True)
    if found_after:
        query = query.filter(Sighting.found_on >= found_after)
    bounds = (west, south, east, north)
    if any(value is not None for value in bounds):
        if any(value is None for value in bounds):
            raise HTTPException(status_code=422, detail="west, south, east, and north must be provided together")
        if south >= north:
            raise HTTPException(status_code=422, detail="south must be less than north")
        # The published point sits up to MAX_OFFSET_MILES from the stored one, so the box is
        # padded to keep edge observations from blinking out as the map is panned. A degree of
        # longitude covers less ground near the poles, so that pad grows with latitude.
        lat_pad = MAX_OFFSET_MILES / MILES_PER_DEGREE
        edge_lat = min(max(abs(south), abs(north)), 89.0)
        lng_pad = min(lat_pad / max(math.cos(math.radians(edge_lat)), 0.05), 20.0)
        query = query.filter(Sighting.latitude.between(
            max(-90.0, south - lat_pad), min(90.0, north + lat_pad)
        ))
        padded_west = normalize_longitude(west - lng_pad)
        padded_east = normalize_longitude(east + lng_pad)
        if (east + lng_pad) - (west - lng_pad) >= 360.0:
            pass
        elif padded_west <= padded_east:
            query = query.filter(Sighting.longitude.between(padded_west, padded_east))
        else:
            query = query.filter(or_(
                Sighting.longitude >= padded_west, Sighting.longitude <= padded_east
            ))
    query = query.order_by(Sighting.found_on.is_(None), Sighting.found_on.desc(), Sighting.created_at.desc())
    return [public_sighting(item) for item in query.limit(limit).all()]


@app.post("/api/sightings", response_model=OwnerSightingRead, status_code=201)
def create_sighting(payload: SightingCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    species = db.get(Species, payload.species_id)
    if species is None:
        raise HTTPException(status_code=404, detail="Species not found")
    data = payload.model_dump(exclude={"month"})
    month = payload.month or (payload.found_on.month if payload.found_on else None)
    sighting = Sighting(**data, user_id=user.id, month=month, source="community", confidence_score=50)
    db.add(sighting)
    user.total_finds += 1
    db.commit()
    db.refresh(sighting)
    return sighting


@app.get("/api/account/logbook", response_model=list[OwnerSightingRead])
def list_logbook(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Sighting).options(joinedload(Sighting.species)).filter(
        Sighting.user_id == user.id
    ).order_by(Sighting.created_at.desc()).all()


def owned_sighting(db: Session, sighting_id: UUID, user: User) -> Sighting:
    sighting = db.get(Sighting, sighting_id)
    if sighting is None or sighting.user_id != user.id:
        raise HTTPException(status_code=404, detail="Observation not found")
    return sighting


@app.patch("/api/account/logbook/{sighting_id}", response_model=OwnerSightingRead)
def update_logbook_sighting(
    sighting_id: UUID,
    payload: SightingUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sighting = owned_sighting(db, sighting_id, user)
    changes = payload.model_dump(exclude_unset=True)
    if "species_id" in changes and db.get(Species, changes["species_id"]) is None:
        raise HTTPException(status_code=404, detail="Species not found")
    for key, value in changes.items():
        setattr(sighting, key, value)
    if "found_on" in changes:
        sighting.month = changes["found_on"].month if changes["found_on"] else None
    if sighting.source == "community":
        sighting.review_status = "pending"
        sighting.verified = False
        sighting.review_notes = None
        sighting.reviewer_id = None
        sighting.reviewed_at = None
    db.commit()
    db.refresh(sighting)
    return sighting


@app.delete("/api/account/logbook/{sighting_id}", status_code=204)
def delete_logbook_sighting(
    sighting_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sighting = owned_sighting(db, sighting_id, user)
    db.delete(sighting)
    user.total_finds = max(0, user.total_finds - 1)
    db.commit()


@app.get("/api/account/saved", response_model=list[SavedLocationRead])
def list_saved_locations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(SavedLocation).filter(SavedLocation.user_id == user.id).order_by(
        SavedLocation.created_at.desc()
    ).all()


@app.post("/api/account/saved", response_model=SavedLocationRead, status_code=201)
def save_location(payload: SavedLocationCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.sighting_id:
        sighting = db.get(Sighting, payload.sighting_id)
        if sighting is None or sighting.review_status != "approved" or sighting.location_privacy == "private":
            raise HTTPException(status_code=404, detail="Observation not found")
    saved = SavedLocation(**payload.model_dump(), user_id=user.id)
    db.add(saved)
    db.commit()
    db.refresh(saved)
    return saved


@app.delete("/api/account/saved/{saved_id}", status_code=204)
def delete_saved_location(saved_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    saved = db.get(SavedLocation, saved_id)
    if saved is None or saved.user_id != user.id:
        raise HTTPException(status_code=404, detail="Saved place not found")
    db.delete(saved)
    db.commit()


@app.get("/api/moderation/sightings", response_model=list[OwnerSightingRead])
def moderation_queue(
    review_status: str = Query("pending", alias="status", pattern="^(pending|approved|rejected)$"),
    _: User = Depends(require_moderator),
    db: Session = Depends(get_db),
):
    return db.query(Sighting).options(joinedload(Sighting.species)).filter(
        Sighting.review_status == review_status
    ).order_by(Sighting.created_at.asc()).limit(200).all()


@app.patch("/api/moderation/sightings/{sighting_id}", response_model=OwnerSightingRead)
def review_sighting(
    sighting_id: UUID,
    payload: ReviewCreate,
    moderator: User = Depends(require_moderator),
    db: Session = Depends(get_db),
):
    sighting = db.get(Sighting, sighting_id)
    if sighting is None:
        raise HTTPException(status_code=404, detail="Observation not found")
    sighting.review_status = payload.status
    sighting.review_notes = payload.notes
    sighting.reviewer_id = moderator.id
    sighting.reviewed_at = now()
    sighting.verified = payload.status == "approved"
    db.commit()
    db.refresh(sighting)
    return sighting


@app.get("/api/cron/inaturalist")
def import_inaturalist(
    authorization: Optional[str] = Header(None),
    x_cron_secret: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    provided = authorization.removeprefix("Bearer ") if authorization else x_cron_secret
    if not CRON_SECRET or provided != CRON_SECRET:
        raise HTTPException(status_code=401, detail="Invalid cron credential")
    from crawler.inaturalist import run_scheduled_import

    return run_scheduled_import(db)
