from typing import Optional
from datetime import timedelta, datetime
import secrets

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from sqlmodel import select

from app.auth import create_access_token, hash_password, verify_password
from app.db import AsyncSessionLocal
from app.models_devices import User, PasswordResetToken
from app.deps_auth import get_current_user

from fastapi_limiter.depends import RateLimiter


router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


import re

@router.post("/register", response_model=TokenResponse, dependencies=[Depends(RateLimiter(times=5, minutes=1))])
async def register_user(payload: RegisterRequest):
    # 1. Identity Validation (3-16 chars, Alphanumeric/Underscore)
    username = payload.username.strip().lower()
    if not (3 <= len(username) <= 16):
        raise HTTPException(status_code=400, detail="Username must be 3-16 characters.")
    
    if not re.match(r"^[a-zA-Z0-9_]+$", username):
        raise HTTPException(status_code=400, detail="Username can only contain letters, numbers, and underscores.")

    # 2. Legends "Lore-Gate" Blacklist
    blacklist = ["admin", "system", "lcaa", "official", "commissioner"]
    if any(forbidden in username for forbidden in blacklist):
        raise HTTPException(status_code=400, detail="This username is reserved for league operations.")

    async with AsyncSessionLocal() as session:
        # 3. Check for existing Email
        q_email = select(User).where(User.email == payload.email)
        res_email = await session.exec(q_email)
        if res_email.one_or_none():
            raise HTTPException(status_code=400, detail="Email already registered")

        # 4. Check for existing Username
        q_user = select(User).where(User.username == username)
        res_user = await session.exec(q_user)
        if res_user.one_or_none():
            raise HTTPException(status_code=400, detail="Username already taken")

        # 5. Create the User with Identity
        user = User(
            email=payload.email,
            username=username, # Added
            hashed_password=hash_password(payload.password),
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

        token = create_access_token(subject=user.id)
        return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(RateLimiter(times=10, minutes=1))])
async def login_user(payload: LoginRequest):
    async with AsyncSessionLocal() as session:
        q = select(User).where(User.email == payload.email)
        res = await session.exec(q)
        user = res.one_or_none()
        if not user or not user.hashed_password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        if not verify_password(payload.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        token = create_access_token(subject=user.id, expires_delta=timedelta(minutes=60 * 24))
        return TokenResponse(access_token=token)
    

@router.post(
    "/request-password-reset",
    dependencies=[Depends(RateLimiter(times=5, minutes=1))],
)
async def request_password_reset(payload: PasswordResetRequest):
    """
    Beta behavior:
    - If the email exists, create a reset token and return it in the response.
    - If not, return ok without a token.
    """
    debug_token: Optional[str] = None

    async with AsyncSessionLocal() as session:
        q = select(User).where(User.email == payload.email)
        res = await session.exec(q)
        user = res.one_or_none()

        if user:
            token_value = secrets.token_urlsafe(32)
            now = datetime.utcnow()
            expires_at = now + timedelta(minutes=30)

            reset = PasswordResetToken(
                user_id=user.id,
                token=token_value,
                created_at=now,
                expires_at=expires_at,
                used=False,
            )
            session.add(reset)
            await session.commit()

            print(
                f"[PASSWORD-RESET] email={user.email} token={token_value} "
                f"expires_at={expires_at.isoformat()}"
            )

            # For beta: only expose token to the client for NON-admin accounts
            if not user.is_admin:
                debug_token = token_value

    return {
        "ok": True,
        "message": "If this email exists, a password reset link has been created.",
        "token": debug_token,  # will be null/None if email not found
    }


@router.post(
    "/reset-password",
    response_model=TokenResponse,
    dependencies=[Depends(RateLimiter(times=5, minutes=1))],
)
async def reset_password(payload: PasswordResetConfirm):
    """
    Resets the user's password if the token is valid, not expired, and not used.
    Returns a fresh access token so the user is logged in immediately.
    """
    async with AsyncSessionLocal() as session:
        # Look up reset token
        q = select(PasswordResetToken).where(PasswordResetToken.token == payload.token)
        res = await session.exec(q)
        reset = res.one_or_none()

        if not reset or reset.used:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or already used reset token.",
            )

        now = datetime.utcnow()
        if reset.expires_at < now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reset token has expired.",
            )

        # Load the user
        q_user = select(User).where(User.id == reset.user_id)
        res_user = await session.exec(q_user)
        user = res_user.one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid reset token.",
            )

        # Update password
        user.hashed_password = hash_password(payload.new_password)
        reset.used = True

        session.add(user)
        session.add(reset)
        await session.commit()

        # Issue new access token
        token = create_access_token(subject=user.id, expires_delta=timedelta(minutes=60 * 24))
        return TokenResponse(access_token=token)


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "is_admin": current_user.is_admin,
        "created_at": current_user.created_at,
    }
