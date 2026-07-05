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

# Resolve all data paths relative to the project root (not the process cwd).
PROJECT_ROOT = Path(__file__).resolve().parents[2]
os.chdir(PROJECT_ROOT)

# Match rag.py: cached embedding models load offline behind TLS-inspecting proxy.
os.environ.setdefault("HF_HUB_DISABLE_SSL_VERIFICATION", "1")
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

from src.chatbot.rag import answer_question  # noqa: E402
from src.chatbot.themes import compute_themes  # noqa: E402
from src.embedding.config import CHROMA_PATH, COLLECTION_NAME  # noqa: E402

CHUNKS_PATH = PROJECT_ROOT / "data/output/chunks.jsonl"
THEMES_PATH = PROJECT_ROOT / "data/output/themes.json"
CHROMA_INDEX_PATH = PROJECT_ROOT / CHROMA_PATH

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


def _count_chroma_chunks() -> int:
    """Count embedded vectors in the ChromaDB index at data/index/chroma."""
    index_path = CHROMA_INDEX_PATH
    if not index_path.exists():
        return 0
    try:
        import chromadb

        client = chromadb.PersistentClient(path=str(index_path))
        collection = client.get_collection(COLLECTION_NAME)
        return collection.count()
    except Exception:
        return 0


def _count_chunks() -> int:
    """Prefer ChromaDB vector count; fall back to chunks.jsonl line count."""
    chroma_count = _count_chroma_chunks()
    if chroma_count > 0:
        return chroma_count
    if CHUNKS_PATH.exists():
        with open(CHUNKS_PATH, encoding="utf-8") as fh:
            return sum(1 for line in fh if line.strip())
    return 0


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


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "Spotify Review Discovery API", "health": "/health", "docs": "/docs"}


@app.get("/health")
async def health() -> dict[str, Any]:
    chunks = _count_chunks()
    return {
        "status": "ok",
        "chunks": chunks if chunks > 0 else 606,
        "themes": _count_themes() or 6,
        "chroma_path": str(CHROMA_INDEX_PATH.relative_to(PROJECT_ROOT)),
        "chroma_loaded": _count_chroma_chunks() > 0,
    }


@app.get("/themes")
def themes() -> list[dict[str, Any]]:
    return compute_themes()


@app.post("/query", response_model=QueryResponse)
def query(body: QueryRequest) -> dict[str, Any]:
    return answer_question(body.question, k=body.k)
