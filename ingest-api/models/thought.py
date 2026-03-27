"""Pydantic models for ingest API request/response."""

from datetime import datetime
from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field


# --- Ingest input (discriminated union) ---


class TextIngestInput(BaseModel):
    type: Literal["text"] = "text"
    content: str
    source: str | None = None
    metadata: dict | None = Field(
        default=None,
        description="Optional JSON metadata stored on the thought (e.g. project_tag, regime).",
    )


class URLIngestInput(BaseModel):
    type: Literal["url"] = "url"
    url: str
    source: str = "browser"


IngestInput = Annotated[
    Union[TextIngestInput, URLIngestInput],
    Field(discriminator="type"),
]


# --- Ingest response ---


class IngestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    domain_tag: str
    content: str
    source: str | None
    created_at: datetime


# --- Embed (internal) ---


class EmbedRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    thought_id: int = Field(..., alias="thought_id")


class EmbedResponse(BaseModel):
    success: bool = True
