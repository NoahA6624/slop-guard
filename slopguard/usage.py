"""Provider-reported usage is separate from conservative admission reservations."""

import time

from .db import connect


def record(request_id, status, response=None):
    if not request_id:
        return
    incoming = outgoing = total = None
    http_status = getattr(response, "status_code", None)
    if response is not None:
        try:
            body = response.json()
            usage = body.get("usage", {})
            if usage:
                incoming = usage.get("prompt_tokens")
                outgoing = usage.get("completion_tokens")
                total = usage.get("total_tokens")
            elif body.get("usageMetadata"):
                usage = body["usageMetadata"]
                incoming = usage.get("promptTokenCount")
                outgoing = usage.get("candidatesTokenCount", 0) + usage.get(
                    "thoughtsTokenCount", 0
                )
                total = usage.get("totalTokenCount")
        except (ValueError, TypeError, AttributeError):
            pass

    def checked(value):
        return value if type(value) is int and 0 <= value <= 1_000_000_000 else None

    with connect() as db:
        db.execute(
            "UPDATE quota SET input_tokens=?,output_tokens=?,total_tokens=?,status=?,http_status=?,completed=? WHERE id=?",
            (
                checked(incoming),
                checked(outgoing),
                checked(total),
                status,
                http_status,
                time.time(),
                request_id,
            ),
        )
