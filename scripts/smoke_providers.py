"""One bounded, metered call per configured provider using clearly synthetic code."""

import asyncio
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
from slopguard import db, review, roast, scanner


async def main():
    db.migrate()
    if "--inspect-validation" in sys.argv:
        original_validation = review.validate_review

        def inspect(payload, files):
            print(json.dumps({"synthetic_validation_payload": payload}, indent=2))
            return original_validation(payload, files)

        review.validate_review = inspect
    source = (
        "def checkout_total(items):\n    return sum(items)\n\ndef test_checkout_total():\n    assert True\n"
        + "\n" * 8
    )
    files = {"tests/test_checkout.py": source}
    result = await review.review(files)
    findings = scanner.analyze(files, {"tree_complete": False})["findings"]
    presentation = (
        await roast.refine(findings)
        if "--review-only" not in sys.argv
        else "not requested"
    )
    with db.connect() as conn:
        quota = review.quota_status(conn, __import__("time").time())
        usage = [
            dict(r)
            for r in conn.execute(
                "SELECT provider,count(*) calls,sum(tokens) reserved_tokens,sum(neurons) reserved_neurons FROM quota GROUP BY provider"
            )
        ]
    print(
        json.dumps(
            {
                "scope": "explicit synthetic provider smoke test; not a public repository report",
                "review_provider": review.provider(),
                "review_status": result["status"],
                "review_error": result.get("provider_error"),
                "validated_findings": len(result["findings"]),
                "roast_source": presentation,
                "roast_options_cached": sum(
                    bool(f.get("roast_options")) for f in findings
                ),
                "quota_state": quota["state"],
                "limits": quota["limits"],
                "usage": usage,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    asyncio.run(main())
