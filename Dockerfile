# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS parser
WORKDIR /parser
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM python:3.12-slim-bookworm AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    SLOP_DB=/app/data/slopguard.sqlite3
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libstdc++6 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 slopguard \
    && useradd --uid 10001 --gid slopguard --no-create-home slopguard
WORKDIR /app
COPY requirements.txt ./
RUN python -m pip install --no-cache-dir -r requirements.txt
COPY --from=parser /usr/local/bin/node /usr/local/bin/node
COPY --from=parser /parser/node_modules /app/node_modules
COPY slopguard/ ./slopguard/
COPY static/ ./static/
COPY migrations/ ./migrations/
COPY content/ ./content/
COPY scripts/check-js.cjs ./scripts/check-js.cjs
RUN mkdir /app/data && chown 10001:10001 /app/data
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3).close()"]
CMD ["python", "-m", "uvicorn", "slopguard.app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
