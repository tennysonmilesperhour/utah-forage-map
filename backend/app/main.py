from dataclasses import dataclass
import json
import math
from datetime import date, datetime, timedelta
import os
from typing import Optional
from uuid import UUID

import httpx
from fastapi import BackgroundTasks, Cookie, Depends, FastAPI, Header, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.database import Base, engine, get_db
from app.email_service import send_account_email, send_digest_email
from app.models import (
    AccountToken, AlertSubscription, CommunityEvent, CommunityFind, CrawledSource, ForageClub,
    GuideRequestVote, ObservationPhoto, RateLimitEvent, ResourceGuide, SavedLocation,
    SeasonalityCache, Sighting, SourceSync, Species, User, UserSession, Verification,
)
from app.privacy import MAX_OFFSET_MILES, MILES_PER_DEGREE, normalize_longitude, public_sighting
from app.regions import REGIONS, get_region
from app.schemas import (
    AlertSubscriptionCreate, AlertSubscriptionRead, AlertSubscriptionUpdate, CommunityEventRead,
    CommunityFindRead, CommunitySummaryRead, EmailRequest, ForageClubRead, GuideRequestPollRead,
    GuideRequestVoteCreate, GuideSpeciesSummary, OwnerSightingRead, PasswordConfirm,
    PasswordResetConfirm, RegionDetailRead, RegionSummaryRead, ResourceGuideRead, ReviewCreate,
    SavedLocationCreate, SavedLocationRead, SavedLocationUpdate, SeasonalityRead, SessionRead,
    SightingCreate, SightingRead, SightingRecordRead, SightingUpdate, SpeciesRead, TokenRequest,
    UserCreate, UserLogin, UserRead, VerificationChecks, VerificationRead,
)
from app.security import DEFAULT_SECRET_KEY, SECRET_KEY, hash_identifier, hash_token, new_token, passwords


app = FastAPI(title="Mushroom Forage Map API")
SESSION_COOKIE = "ufm_session"
SESSION_DAYS = int(os.getenv("SESSION_DAYS", "30"))
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
ADMIN_EMAILS = {value.strip().lower() for value in os.getenv("ADMIN_EMAILS", "").split(",") if value.strip()}
CRON_SECRET = os.getenv("CRON_SECRET")
GUIDE_REQUEST_POLL_KEY = "next-species-2026-08"
GUIDE_REQUEST_QUESTION = "Which mushroom should we add to the guide next?"
GUIDE_REQUEST_OPTIONS = (
    {"slug": "reishi", "common_name": "Reishi", "latin_name": "Ganoderma tsugae", "reason": "A varnished woodland conk with widespread supplement interest."},
    {"slug": "chaga", "common_name": "Chaga", "latin_name": "Inonotus obliquus", "reason": "A birch canker often confused with other dark growths."},
    {"slug": "wood-ear", "common_name": "Wood Ear", "latin_name": "Auricularia species", "reason": "A globally familiar edible group with a distinctive gelatinous form."},
    {"slug": "cauliflower-mushroom", "common_name": "Cauliflower Mushroom", "latin_name": "Sparassis species", "reason": "A large, folded woodland mushroom that draws frequent ID requests."},
    {"slug": "indigo-milk-cap", "common_name": "Indigo Milk Cap", "latin_name": "Lactarius indigo", "reason": "A vivid blue mushroom with blue latex and memorable bruising."},
    {"slug": "dryads-saddle", "common_name": "Dryad's Saddle", "latin_name": "Cerioporus squamosus", "reason": "A common spring polypore found on hardwood trunks and stumps."},
    {"slug": "beefsteak-fungus", "common_name": "Beefsteak Fungus", "latin_name": "Fistulina hepatica", "reason": "A red, fleshy bracket fungus associated with mature hardwoods."},
    {"slug": "candy-cap", "common_name": "Candy Cap", "latin_name": "Lactarius rubidus", "reason": "A small western milk cap known for its maple-like aroma when dried."},
)
GUIDE_REQUEST_OPTION_SLUGS = {item["slug"] for item in GUIDE_REQUEST_OPTIONS}
SEASONALITY_MAX_AGE = timedelta(days=14)
INATURALIST_HISTOGRAM_URL = "https://api.inaturalist.org/v1/observations/histogram"
INATURALIST_FUNGI_TAXON_ID = 47170
INATURALIST_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "MushroomForageMap/2.1 (https://utah-forage-map.vercel.app)",
}

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


def region_sighting_query(db: Session, region, include_historical: bool = False):
    west, south, east, north = region["bounds"]
    query = db.query(Sighting).options(joinedload(Sighting.species)).filter(
        Sighting.latitude.between(south, north),
        Sighting.longitude.between(west, east),
        Sighting.location_privacy != "private",
    )
    if not include_historical:
        query = query.filter(Sighting.review_status == "approved")
    else:
        query = query.filter(or_(Sighting.source == "iNaturalist", Sighting.review_status == "approved"))
    return query


def verification_values(payload: VerificationChecks):
    values = payload.model_dump(exclude={"status"})
    values["confirmed"] = payload.conclusion == "supports"
    return values


def verification_summary(sighting: Sighting):
    verifications = sorted(sighting.verifications, key=lambda item: item.verified_at, reverse=True)
    coverage_fields = (
        "cap_checked", "underside_checked", "stem_checked", "base_checked",
        "interior_checked", "substrate_checked", "lookalikes_checked",
    )
    return {
        "total": len(verifications),
        "supports": sum(item.conclusion == "supports" for item in verifications),
        "uncertain": sum(item.conclusion == "uncertain" for item in verifications),
        "disagrees": sum(item.conclusion == "disagrees" for item in verifications),
        "field_mark_coverage": {
            field.removesuffix("_checked"): sum(bool(getattr(item, field)) for item in verifications)
            for field in coverage_fields
        },
        "recent": verifications[:5],
    }


def sync_photo_urls(sighting: Sighting, urls: list[str]):
    unique_urls = list(dict.fromkeys(value for value in urls if value))
    existing = {item.url: item for item in sighting.photos}
    sighting.photos[:] = [existing.get(url) or ObservationPhoto(url=url) for url in unique_urls]
    for index, photo in enumerate(sighting.photos):
        photo.position = index
    sighting.photo_url = unique_urls[0] if unique_urls else None


def alert_subscription_read(subscription: AlertSubscription):
    region = get_region(subscription.region_slug) if subscription.region_slug else None
    return {
        "id": subscription.id,
        "kind": subscription.kind,
        "target_key": subscription.target_key,
        "species_taxon_id": subscription.species.inaturalist_taxon_id if subscription.species else None,
        "species_name": subscription.species.common_name if subscription.species else None,
        "region_slug": subscription.region_slug,
        "region_name": region["name"] if region else None,
        "enabled": subscription.enabled,
        "created_at": subscription.created_at,
        "last_sent_at": subscription.last_sent_at,
    }


def public_record(sighting: Sighting):
    source = sighting.crawled_sources[0] if sighting.crawled_sources else None
    source_attribution = next((item.attribution for item in sighting.photos if item.attribution), None)
    photos = list(sighting.photos)
    if not photos and sighting.photo_url:
        photos = [{
            "id": sighting.id,
            "url": sighting.photo_url,
            "attribution": source_attribution,
            "source_url": source.source_url if source else None,
            "position": 0,
        }]
    return {
        **public_sighting(sighting),
        "photos": photos,
        "source_url": source.source_url if source else None,
        "source_attribution": source_attribution,
        "verification": verification_summary(sighting),
    }


def region_summary(db: Session, region):
    today = date.today()
    query = region_sighting_query(db, region)
    observations_90d = query.filter(Sighting.found_on >= today - timedelta(days=90)).count()
    observations_14d = query.filter(Sighting.found_on >= today - timedelta(days=14)).count()
    species_count = query.filter(Sighting.found_on >= today - timedelta(days=90)).with_entities(
        func.count(func.distinct(Sighting.species_id))
    ).scalar() or 0
    latest_observed_on = query.with_entities(func.max(Sighting.found_on)).scalar()
    return {
        **region,
        "observations_90d": observations_90d,
        "observations_14d": observations_14d,
        "species_count": species_count,
        "latest_observed_on": latest_observed_on,
    }


def require_cron(authorization: Optional[str], x_cron_secret: Optional[str]):
    provided = authorization.removeprefix("Bearer ") if authorization else x_cron_secret
    if not CRON_SECRET or provided != CRON_SECRET:
        raise HTTPException(status_code=401, detail="Invalid cron credential")


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
    db.query(AlertSubscription).filter(AlertSubscription.user_id == auth.user.id).delete()
    db.query(Sighting).filter(
        Sighting.user_id == auth.user.id,
        or_(Sighting.location_privacy == "private", Sighting.review_status != "approved"),
    ).delete(synchronize_session=False)
    db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/", samesite="lax")


@app.get("/api/species", response_model=list[SpeciesRead])
def list_species(db: Session = Depends(get_db)):
    return db.query(Species).order_by(Species.common_name.asc()).all()


@app.get("/api/guide/species", response_model=list[GuideSpeciesSummary])
def guide_species_summaries(db: Session = Depends(get_db)):
    cutoff = date.today() - timedelta(days=90)
    public_filters = (
        Sighting.review_status == "approved",
        Sighting.location_privacy != "private",
        Sighting.found_on >= cutoff,
    )
    summaries = []

    for species in db.query(Species).filter(Species.inaturalist_taxon_id.isnot(None)).all():
        query = db.query(Sighting).filter(*public_filters, Sighting.species_id == species.id)
        latest = query.filter(Sighting.photo_url.isnot(None)).order_by(
            Sighting.found_on.desc(), Sighting.created_at.desc()
        ).first()
        source_url = None
        attribution = None

        if latest:
            source = db.query(CrawledSource).filter(CrawledSource.sighting_id == latest.id).first()
            if source:
                source_url = source.source_url
                try:
                    raw_data = json.loads(source.raw_data or "{}")
                    attribution = ((raw_data.get("photos") or [{}])[0]).get("attribution")
                except (TypeError, ValueError, json.JSONDecodeError):
                    attribution = None

        summaries.append({
            "species_id": species.id,
            "inaturalist_taxon_id": species.inaturalist_taxon_id,
            "recent_observations": query.count(),
            "latest_observed_on": query.with_entities(func.max(Sighting.found_on)).scalar(),
            "latest_photo_url": latest.photo_url if latest else None,
            "latest_photo_attribution": attribution,
            "latest_source_url": source_url,
        })

    return summaries


def guide_request_summary(db: Session, voter_token: Optional[str] = None):
    vote_counts = dict(
        db.query(GuideRequestVote.choice_slug, func.count(GuideRequestVote.id))
        .filter(GuideRequestVote.poll_key == GUIDE_REQUEST_POLL_KEY)
        .group_by(GuideRequestVote.choice_slug)
        .all()
    )
    selection = None
    if voter_token:
        try:
            normalized_token = str(UUID(voter_token))
        except (TypeError, ValueError):
            normalized_token = None
        if normalized_token:
            vote = db.query(GuideRequestVote).filter(
                GuideRequestVote.poll_key == GUIDE_REQUEST_POLL_KEY,
                GuideRequestVote.voter_hash == hash_identifier(normalized_token),
            ).one_or_none()
            selection = vote.choice_slug if vote else None
    options = [{**item, "votes": vote_counts.get(item["slug"], 0)} for item in GUIDE_REQUEST_OPTIONS]
    return {
        "poll_key": GUIDE_REQUEST_POLL_KEY,
        "question": GUIDE_REQUEST_QUESTION,
        "total_votes": sum(vote_counts.values()),
        "selection": selection,
        "options": options,
    }


@app.get("/api/guide/requests", response_model=GuideRequestPollRead)
def guide_requests(
    voter_token: Optional[str] = Header(None, alias="X-Guide-Voter"),
    db: Session = Depends(get_db),
):
    return guide_request_summary(db, voter_token)


@app.post("/api/guide/requests", response_model=GuideRequestPollRead)
def vote_for_guide_request(
    payload: GuideRequestVoteCreate,
    request: Request,
    voter_token: str = Header(..., alias="X-Guide-Voter"),
    db: Session = Depends(get_db),
):
    try:
        normalized_token = str(UUID(voter_token))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="A valid anonymous voter token is required")
    if payload.choice_slug not in GUIDE_REQUEST_OPTION_SLUGS:
        raise HTTPException(status_code=422, detail="Choose an available mushroom")

    enforce_rate_limit(db, "guide_vote", f"{request_ip(request)}:{normalized_token}", 20, 60)
    voter_hash = hash_identifier(normalized_token)
    vote = db.query(GuideRequestVote).filter(
        GuideRequestVote.poll_key == GUIDE_REQUEST_POLL_KEY,
        GuideRequestVote.voter_hash == voter_hash,
    ).one_or_none()
    if vote:
        vote.choice_slug = payload.choice_slug
    else:
        db.add(GuideRequestVote(
            poll_key=GUIDE_REQUEST_POLL_KEY,
            choice_slug=payload.choice_slug,
            voter_hash=voter_hash,
        ))
    db.commit()
    return guide_request_summary(db, normalized_token)


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


@app.get("/api/regions", response_model=list[RegionSummaryRead])
def list_regions(db: Session = Depends(get_db)):
    return [region_summary(db, region) for region in REGIONS]


@app.get("/api/regions/{region_slug}", response_model=RegionDetailRead)
def get_region_detail(region_slug: str, db: Session = Depends(get_db)):
    region = get_region(region_slug)
    if region is None:
        raise HTTPException(status_code=404, detail="Region not found")
    today = date.today()
    observations = region_sighting_query(db, region).filter(
        Sighting.found_on >= today - timedelta(days=60)
    ).order_by(Sighting.found_on.desc()).all()
    by_species = {}
    for sighting in observations:
        item = by_species.setdefault(sighting.species_id, {
            "species": sighting.species,
            "observations_14d": 0,
            "observations_30d": 0,
            "previous_30d": 0,
            "latest_observed_on": sighting.found_on,
        })
        if sighting.found_on >= today - timedelta(days=14):
            item["observations_14d"] += 1
        if sighting.found_on >= today - timedelta(days=30):
            item["observations_30d"] += 1
        else:
            item["previous_30d"] += 1

    outlook = []
    for item in by_species.values():
        recent = item["observations_14d"]
        current = item["observations_30d"]
        previous = item["previous_30d"]
        if recent == 0 and previous > 0:
            outlook_status = "ending"
        elif recent > 0 and (previous == 0 or current >= max(2, previous * 1.5)):
            outlook_status = "starting"
        else:
            outlook_status = "likely"
        sample = current + previous
        confidence = "high" if sample >= 10 else "medium" if sample >= 3 else "low"
        outlook.append({**item, "status": outlook_status, "confidence": confidence})
    outlook.sort(key=lambda item: (
        {"starting": 0, "likely": 1, "ending": 2}[item["status"]],
        -item["observations_14d"],
        item["species"].common_name,
    ))
    recent_observations = [public_sighting(item) for item in observations[:18]]
    return {
        **region_summary(db, region),
        "outlook": outlook[:12],
        "recent_observations": recent_observations,
    }


@app.get("/api/seasonality", response_model=SeasonalityRead)
def get_seasonality(
    taxon_id: Optional[int] = Query(None, ge=1),
    region_slug: Optional[str] = Query(None, pattern=r"^[a-z0-9-]+$"),
    hemisphere: Optional[str] = Query(None, pattern="^(north|south)$"),
    db: Session = Depends(get_db),
):
    if taxon_id and not db.query(Species.id).filter(Species.inaturalist_taxon_id == taxon_id).first():
        raise HTTPException(status_code=404, detail="Species not found")
    region = get_region(region_slug) if region_slug else None
    if region_slug and region is None:
        raise HTTPException(status_code=404, detail="Region not found")
    if region and hemisphere:
        raise HTTPException(status_code=422, detail="Choose a region or a hemisphere, not both")
    if not region:
        hemisphere = hemisphere or "north"
    scope = f"region:{region['slug']}" if region else f"hemisphere:{hemisphere}"
    key = f"taxon:{taxon_id or 'all'}:{scope}"
    cached = db.get(SeasonalityCache, key)
    if cached and cached.synced_at >= now() - SEASONALITY_MAX_AGE:
        return {
            "key": key,
            "taxon_id": taxon_id,
            "region_slug": region["slug"] if region else None,
            "hemisphere": hemisphere if not region else None,
            "counts": json.loads(cached.counts_json),
            "sample_size": cached.sample_size,
            "synced_at": cached.synced_at,
            "source": "iNaturalist research-grade observations",
        }

    west, south, east, north = region["bounds"] if region else (
        -180.0, 0.0 if hemisphere == "north" else -90.0,
        180.0, 90.0 if hemisphere == "north" else 0.0,
    )
    params = {
        "taxon_id": taxon_id or INATURALIST_FUNGI_TAXON_ID,
        "quality_grade": "research",
        "captive": "false",
        "date_field": "observed",
        "interval": "month_of_year",
        "verifiable": "true",
        "swlat": south,
        "swlng": west,
        "nelat": north,
        "nelng": east,
    }
    try:
        response = httpx.get(
            INATURALIST_HISTOGRAM_URL,
            params=params,
            headers=INATURALIST_HEADERS,
            timeout=20,
        )
        response.raise_for_status()
        histogram = response.json().get("results", {}).get("month_of_year", {})
        counts = [int(histogram.get(str(month), 0)) for month in range(1, 13)]
    except (httpx.HTTPError, TypeError, ValueError):
        if cached:
            return {
                "key": key,
                "taxon_id": taxon_id,
                "region_slug": region["slug"] if region else None,
                "hemisphere": hemisphere if not region else None,
                "counts": json.loads(cached.counts_json),
                "sample_size": cached.sample_size,
                "synced_at": cached.synced_at,
                "source": "iNaturalist research-grade observations",
            }
        raise HTTPException(status_code=503, detail="Seasonal archive is temporarily unavailable")
    sample_size = sum(counts)
    if cached is None:
        cached = SeasonalityCache(cache_key=key, counts_json="[]")
        db.add(cached)
    cached.counts_json = json.dumps(counts)
    cached.sample_size = sample_size
    cached.synced_at = now()
    db.commit()
    return {
        "key": key,
        "taxon_id": taxon_id,
        "region_slug": region["slug"] if region else None,
        "hemisphere": hemisphere if not region else None,
        "counts": counts,
        "sample_size": sample_size,
        "synced_at": cached.synced_at,
        "source": "iNaturalist research-grade observations",
    }


@app.get("/api/sightings", response_model=list[SightingRead])
def list_sightings(
    species_id: Optional[str] = Query(None),
    taxon_id: Optional[int] = Query(None, ge=1),
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
    if taxon_id or edibility_group:
        query = query.join(Sighting.species)
    if taxon_id:
        query = query.filter(Species.inaturalist_taxon_id == taxon_id)
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
        query = query.filter(Species.edibility.in_(values))
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


@app.get("/api/sightings/{sighting_id}/record", response_model=SightingRecordRead)
def get_sighting_record(sighting_id: UUID, db: Session = Depends(get_db)):
    sighting = db.query(Sighting).options(
        joinedload(Sighting.species),
        joinedload(Sighting.photos),
        joinedload(Sighting.verifications),
        joinedload(Sighting.crawled_sources),
    ).filter(
        Sighting.id == sighting_id,
        Sighting.review_status == "approved",
        Sighting.location_privacy != "private",
    ).one_or_none()
    if sighting is None:
        raise HTTPException(status_code=404, detail="Observation not found")
    return public_record(sighting)


@app.post("/api/sightings/{sighting_id}/verifications", response_model=SightingRecordRead)
def verify_sighting(
    sighting_id: UUID,
    payload: VerificationChecks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user.email_verified:
        raise HTTPException(status_code=403, detail="Verify your email before reviewing observations")
    sighting = db.query(Sighting).options(
        joinedload(Sighting.species),
        joinedload(Sighting.photos),
        joinedload(Sighting.verifications),
        joinedload(Sighting.crawled_sources),
    ).filter(
        Sighting.id == sighting_id,
        Sighting.review_status == "approved",
        Sighting.location_privacy != "private",
    ).one_or_none()
    if sighting is None:
        raise HTTPException(status_code=404, detail="Observation not found")
    if sighting.user_id == user.id and sighting.source == "community":
        raise HTTPException(status_code=403, detail="You cannot verify your own observation")
    verification = db.query(Verification).filter(
        Verification.sighting_id == sighting.id,
        Verification.verifier_id == user.id,
    ).one_or_none()
    values = verification_values(payload)
    if verification is None:
        verification = Verification(sighting=sighting, verifier_id=user.id, **values)
        db.add(verification)
    else:
        for key, value in values.items():
            setattr(verification, key, value)
        verification.verified_at = now()
    db.commit()
    db.refresh(sighting)
    return public_record(sighting)


@app.post("/api/sightings", response_model=OwnerSightingRead, status_code=201)
def create_sighting(payload: SightingCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    species = db.get(Species, payload.species_id)
    if species is None:
        raise HTTPException(status_code=404, detail="Species not found")
    data = payload.model_dump(exclude={"month", "photo_urls"})
    photo_urls = payload.photo_urls or ([payload.photo_url] if payload.photo_url else [])
    data["photo_url"] = photo_urls[0] if photo_urls else None
    month = payload.month or (payload.found_on.month if payload.found_on else None)
    sighting = Sighting(**data, user_id=user.id, month=month, source="community", confidence_score=50)
    sync_photo_urls(sighting, photo_urls)
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
    photo_urls = changes.pop("photo_urls", None)
    if "species_id" in changes and db.get(Species, changes["species_id"]) is None:
        raise HTTPException(status_code=404, detail="Species not found")
    for key, value in changes.items():
        setattr(sighting, key, value)
    if photo_urls is not None:
        sync_photo_urls(sighting, photo_urls)
    elif "photo_url" in changes:
        sync_photo_urls(sighting, [changes["photo_url"]] if changes["photo_url"] else [])
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


@app.patch("/api/account/saved/{saved_id}", response_model=SavedLocationRead)
def update_saved_location(
    saved_id: UUID,
    payload: SavedLocationUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    saved = db.get(SavedLocation, saved_id)
    if saved is None or saved.user_id != user.id:
        raise HTTPException(status_code=404, detail="Saved place not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(saved, key, value)
    db.commit()
    db.refresh(saved)
    return saved


@app.get("/api/account/alerts", response_model=list[AlertSubscriptionRead])
def list_alerts(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    subscriptions = db.query(AlertSubscription).options(joinedload(AlertSubscription.species)).filter(
        AlertSubscription.user_id == user.id
    ).order_by(AlertSubscription.created_at.desc()).all()
    return [alert_subscription_read(item) for item in subscriptions]


@app.post("/api/account/alerts", response_model=AlertSubscriptionRead, status_code=201)
def create_alert(
    payload: AlertSubscriptionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user.email_verified:
        raise HTTPException(status_code=403, detail="Verify your email before creating alerts")
    species = None
    region_slug = None
    if payload.kind == "species":
        species = db.query(Species).filter(
            Species.inaturalist_taxon_id == payload.species_taxon_id
        ).one_or_none()
        if species is None:
            raise HTTPException(status_code=404, detail="Species not found")
        target_key = f"species:{species.inaturalist_taxon_id}"
    else:
        region = get_region(payload.region_slug)
        if region is None:
            raise HTTPException(status_code=404, detail="Region not found")
        region_slug = region["slug"]
        target_key = f"region:{region_slug}"
    subscription = db.query(AlertSubscription).filter(
        AlertSubscription.user_id == user.id,
        AlertSubscription.target_key == target_key,
    ).one_or_none()
    if subscription is None:
        subscription = AlertSubscription(
            user_id=user.id,
            target_key=target_key,
            kind=payload.kind,
            species_id=species.id if species else None,
            region_slug=region_slug,
        )
        db.add(subscription)
    else:
        subscription.enabled = True
    db.commit()
    subscription = db.query(AlertSubscription).options(joinedload(AlertSubscription.species)).filter(
        AlertSubscription.id == subscription.id
    ).one()
    return alert_subscription_read(subscription)


@app.patch("/api/account/alerts/{subscription_id}", response_model=AlertSubscriptionRead)
def update_alert(
    subscription_id: UUID,
    payload: AlertSubscriptionUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subscription = db.query(AlertSubscription).options(joinedload(AlertSubscription.species)).filter(
        AlertSubscription.id == subscription_id,
        AlertSubscription.user_id == user.id,
    ).one_or_none()
    if subscription is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    subscription.enabled = payload.enabled
    db.commit()
    db.refresh(subscription)
    return alert_subscription_read(subscription)


@app.delete("/api/account/alerts/{subscription_id}", status_code=204)
def delete_alert(
    subscription_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subscription = db.get(AlertSubscription, subscription_id)
    if subscription is None or subscription.user_id != user.id:
        raise HTTPException(status_code=404, detail="Alert not found")
    db.delete(subscription)
    db.commit()


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
    verification = db.query(Verification).filter(
        Verification.sighting_id == sighting.id,
        Verification.verifier_id == moderator.id,
    ).one_or_none()
    values = verification_values(payload)
    if verification is None:
        db.add(Verification(sighting=sighting, verifier_id=moderator.id, **values))
    else:
        for key, value in values.items():
            setattr(verification, key, value)
        verification.verified_at = now()
    db.commit()
    db.refresh(sighting)
    return sighting


@app.get("/api/cron/inaturalist")
def import_inaturalist(
    authorization: Optional[str] = Header(None),
    x_cron_secret: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    require_cron(authorization, x_cron_secret)
    from crawler.inaturalist import run_scheduled_import

    return run_scheduled_import(db)


@app.get("/api/cron/alerts")
def send_weekly_alerts(
    authorization: Optional[str] = Header(None),
    x_cron_secret: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    require_cron(authorization, x_cron_secret)
    if not os.getenv("RESEND_API_KEY"):
        return {"status": "skipped", "reason": "email_not_configured", "users_emailed": 0}
    due_before = now() - timedelta(days=7)
    subscriptions = db.query(AlertSubscription).options(
        joinedload(AlertSubscription.user), joinedload(AlertSubscription.species)
    ).filter(
        AlertSubscription.enabled == True,
        or_(AlertSubscription.last_sent_at.is_(None), AlertSubscription.last_sent_at <= due_before),
    ).all()
    by_user = {}
    for subscription in subscriptions:
        by_user.setdefault(subscription.user_id, []).append(subscription)

    cutoff = date.today() - timedelta(days=7)
    users_emailed = 0
    activity_items = 0
    checked = 0
    for user_subscriptions in by_user.values():
        user = user_subscriptions[0].user
        if not user or not user.is_active or not user.email_verified:
            continue
        items = []
        for subscription in user_subscriptions:
            query = db.query(Sighting).options(joinedload(Sighting.species)).filter(
                Sighting.review_status == "approved",
                Sighting.location_privacy != "private",
                Sighting.found_on >= cutoff,
            )
            if subscription.kind == "species":
                query = query.filter(Sighting.species_id == subscription.species_id)
                label = subscription.species.common_name
                path = f"/?taxon={subscription.species.inaturalist_taxon_id}"
            else:
                region = get_region(subscription.region_slug)
                if region is None:
                    continue
                west, south, east, north = region["bounds"]
                query = query.filter(
                    Sighting.latitude.between(south, north),
                    Sighting.longitude.between(west, east),
                )
                label = region["name"]
                path = f"/regions/{region['slug']}"
            recent = query.order_by(Sighting.found_on.desc()).all()
            if recent:
                species_names = ", ".join(dict.fromkeys(
                    item.species.common_name for item in recent[:3]
                ))
                items.append({
                    "label": label,
                    "path": path,
                    "summary": (
                        f"{len(recent)} public observation{'s' if len(recent) != 1 else ''} "
                        f"in the past week. Recent finds include {species_names}."
                    ),
                })
        sent = send_digest_email(user.email, user.username, items) if items else False
        if sent:
            users_emailed += 1
            activity_items += len(items)
        if sent or not items:
            for subscription in user_subscriptions:
                subscription.last_sent_at = now()
                checked += 1
    db.commit()
    return {
        "status": "ok",
        "users_emailed": users_emailed,
        "activity_items": activity_items,
        "subscriptions_checked": checked,
    }
