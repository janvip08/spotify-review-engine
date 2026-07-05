"""FastAPI backend — RAG query, themes, and health endpoints."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

# Match rag.py: cached embedding models load offline behind TLS-inspecting proxy.
os.environ.setdefault("HF_HUB_DISABLE_SSL_VERIFICATION", "1")
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

from src.chatbot.rag import answer_question  # noqa: E402
from src.chatbot.themes import compute_themes  # noqa: E402

CHUNKS_PATH = Path("data/output/chunks.jsonl")
THEMES_PATH = Path("data/output/themes.json")

app = FastAPI(title="Spotify Review Discovery API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    question: str
    k: int = Field(default=5, ge=1, le=20)


class QueryResponse(BaseModel):
    answer: str
    sources: list[dict[str, Any]]


def _count_chunks() -> int:
    if not CHUNKS_PATH.exists():
        return 0
    with open(CHUNKS_PATH, encoding="utf-8") as fh:
        return sum(1 for line in fh if line.strip())


def _count_themes() -> int:
    if not THEMES_PATH.exists():
        return 0
    with open(THEMES_PATH, encoding="utf-8") as fh:
        data = json.load(fh)
    if isinstance(data, dict) and "themes" in data:
        return len(data["themes"])
    if isinstance(data, list):
        return len(data)
    return 0


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "chunks": _count_chunks(),
        "themes": _count_themes(),
    }


@app.get("/themes")
def themes() -> list[dict[str, Any]]:
    return compute_themes()


@app.post("/query", response_model=QueryResponse)
def query(body: QueryRequest) -> dict[str, Any]:
    return answer_question(body.question, k=body.k)
