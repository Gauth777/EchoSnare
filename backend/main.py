from __future__ import annotations

import os
from pathlib import Path

os.environ["TOKENIZERS_PARALLELISM"] = "false"

from dotenv import load_dotenv

# Load credentials from backend/.env, root/.env.local, or root/.env
load_dotenv(Path(__file__).parent / ".env")
load_dotenv(Path(__file__).parent.parent / ".env.local")
load_dotenv(Path(__file__).parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router
from db.seed import seed_database


def create_app() -> FastAPI:
    app = FastAPI(
        title="Real-Time Coordinated Misinformation Campaign Detection System",
        version="1.0.0",
        description="Backend AI services for content, network, campaign, and threat analysis.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:3003", "https://*.vercel.app"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)
    return app


app = create_app()


import threading

def _safe_seed() -> None:
    try:
        seed_database()
    except Exception as exc:
        print(f"[startup] Neo4j seeding skipped: {exc}")

@app.on_event("startup")
async def startup() -> None:
    threading.Thread(target=_safe_seed, daemon=True).start()
