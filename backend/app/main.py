from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import admin, attendance, auth, notifications


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="Tsukisamu Study Log API",
    description="月寒スタディルーム 入退塾管理・学習記録 API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(attendance.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")


@app.get("/health")
def health_check():
    return {"status": "ok", "env": settings.app_env}
