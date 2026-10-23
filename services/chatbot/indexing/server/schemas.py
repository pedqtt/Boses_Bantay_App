from typing import Literal
from pydantic import BaseModel, Field


class Evidence(BaseModel):
    source_id: int = Field(ge=1, le=12)
    quote: str = Field(min_length=1, max_length=1600)


class Claim(BaseModel):
    text: str = Field(min_length=1, max_length=600)
    kind: Literal["documented", "inference"] = "documented"
    evidence: list[Evidence] = Field(min_length=1, max_length=4)


class Disagreement(BaseModel):
    topic: str = Field(min_length=1, max_length=200)
    evidence: list[Evidence] = Field(min_length=2, max_length=4)


class Draft(BaseModel):
    status: Literal["answered", "partial", "ambiguous", "conflict", "low_confidence", "no_information"] = Field(description='Coverage of the actual user question: answered if all requested details are supported; partial if only some requested details are supported; ambiguous if the intended subject cannot be selected; conflict for contradictory sources; no_information if none of the requested facts are supported; low_confidence if evidence is uncertain.')
    claims: list[Claim] = Field(default_factory=list, max_length=5,description='Direct answers with exact source quotes. Faithful paraphrases and translations are documented facts; interpretations beyond the explicit wording are inferences.')
    missing_aspects: list[str] = Field(default_factory=list, max_length=4,description='Only explicitly requested information absent from the evidence. Never list an answered question or introduce a new request.')
    clarification: str = Field(default="", max_length=400)
    options: list[str] = Field(default_factory=list, max_length=4)
    disagreements: list[Disagreement] = Field(default_factory=list, max_length=3)


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1200)


class ChatRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    history: list[Turn] = Field(default_factory=list, max_length=6)


class QueryPlan(BaseModel):
    query: str = Field(min_length=1,max_length=500,description='Standalone question preserving every requested part. Resolve references only from user history.')
    aspects: list[str] = Field(min_length=1,max_length=5,description='Every detail actually requested, without adding new questions.')
    search_queries: list[str] = Field(min_length=1,max_length=4,description='Up to three faithful searches, at most 300 characters each, covering distinct requested parts and useful source-language variants. Never invent a subject or answer.')
    subject_quote: str = Field(max_length=300,description='Exact words from the user question or user history identifying the service, entity, document or policy. Copy those words when present. Empty only if the question leaves its subject unspecified.')
