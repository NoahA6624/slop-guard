"""Fail-closed operational gates. Account attestations must be verified by the owner."""

import os
import re
from datetime import datetime, timezone

MODELS = {
    "groq": {"openai/gpt-oss-120b"},
    "gemini": {"gemini-3.1-flash-lite"},
    "cloudflare": {"@cf/zai-org/glm-4.7-flash"},
}
SECRET_PATTERN = re.compile(
    r"AIza[0-9A-Za-z_-]{30,}|(?:gsk_|sk-proj-|ghp_|github_pat_)[0-9A-Za-z_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?i:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*[\"\'][^\"\'\s]{16,}[\"\']"
)


def current_attestation(provider):
    value = os.getenv(provider.upper() + "_VERIFIED_UNTIL", "")
    try:
        expires = datetime.fromisoformat(value.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        return (
            expires.tzinfo is not None
            and 0 < (expires - now).total_seconds() <= 8 * 86400
        )
    except ValueError:
        return False


def gate(provider, model):
    if os.getenv("AI_ENABLED", "false") != "true":
        return "AI calls are disabled by the global switch."
    if model not in MODELS.get(provider, set()):
        return "Model is not in the reviewed free-provider allowlist."
    if not current_attestation(provider):
        return "Free-plan verification is missing or expired. Recheck the account and current terms."
    if os.getenv(provider.upper() + "_BILLING_DISABLED", "false") != "true":
        return "A billing-disabled account must be confirmed."
    if provider == "gemini" and os.getenv("DEPLOYMENT_AUDIENCE") != "local-adult-pilot":
        return "Gemini is restricted to the verified local adult developer pilot; public review uses Groq."
    return None


def safe_excerpts(files):
    safe, skipped = {}, []
    for path, text in files.items():
        if SECRET_PATTERN.search(text):
            skipped.append(path)
        else:
            safe[path] = text
    return safe, skipped


def loopback_request(request):
    # Never trust forwarding headers to establish local pilot eligibility.
    return request.client is not None and request.client.host in {
        "127.0.0.1",
        "::1",
        "testclient",
        "testserver",
    }
