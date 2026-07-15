from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import UPLOADS_DIR
from app.database import init_db
from app.routers import analytics, defects, queue, reports, reviews, segments


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="RoadWatch API",
    description="AI-assisted road defect detection & repair prioritization. "
    "The API ranks and explains defects; only POST /defects/{id}/review can change a defect's status.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=UPLOADS_DIR), name="media")

app.include_router(defects.router)
app.include_router(reports.router)
app.include_router(queue.router)
app.include_router(reviews.router)
app.include_router(analytics.router)
app.include_router(segments.router)


@app.get("/health")
def health():
    return {"status": "ok"}
