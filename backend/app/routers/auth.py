from datetime import timedelta

from fastapi import APIRouter, HTTPException, status
from fastapi import Depends
from pydantic import BaseModel, EmailStr
from sqlmodel import select

from app.auth import create_access_token, hash_password, verify_password
from app.db import AsyncSessionLocal
from app.models_devices import User
from app.deps_auth import get_current_user 

from fastapi_limiter.depends import RateLimiter

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/register", response_model=TokenResponse, dependencies=[Depends(RateLimiter(times=5, minutes=1))])
async def register_user(payload: RegisterRequest):
    async with AsyncSessionLocal() as session:
        q = select(User).where(User.email == payload.email)
        res = await session.exec(q)
        existing = res.one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

        user = User(
            email=payload.email,
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


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "is_admin": current_user.is_admin,
        "created_at": current_user.created_at,
    }
