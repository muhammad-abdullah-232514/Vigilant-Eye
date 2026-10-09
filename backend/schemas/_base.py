"""Shared base models for request payloads.

InputModel centralises two constraints every request body should enforce:

* ``str_strip_whitespace`` — surrounding whitespace is trimmed before length
  validation runs, so a whitespace-only value such as ``"   "`` can no longer
  satisfy a ``min_length`` constraint (it becomes ``""`` and is rejected).
* ``extra="ignore"`` — unexpected client-supplied fields are dropped rather
  than silently bound, guarding against mass-assignment of server-owned
  columns (ids, timestamps, status, role, …).

Credential payloads (passwords, ID tokens) intentionally do NOT inherit this
base: stripping would silently alter the secret the user actually typed.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class InputModel(BaseModel):
    """Base for request-body schemas carrying free-text / reference fields."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")
