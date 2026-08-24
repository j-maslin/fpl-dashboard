#!/usr/bin/env python3
"""Fetch public Fantasy Premier League data for the configured classic league."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

LEAGUE_ID = os.getenv("FPL_LEAGUE_ID", "1112007")
BASE_URL = "https://fantasy.premierleague.com/api"
OUT_FILE = Path(__file__).resolve().parents[1] / "data" / "fpl-data.json"
USER_AGENT = "Mozilla/5.0 (compatible; GitHub-FPL-Dashboard/1.0)"


def fetch_json(url: str) -> dict:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"FPL returned HTTP {exc.code} for {url}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Could not reach FPL for {url}: {exc.reason}") from exc


def current_gameweek(bootstrap: dict) -> int | None:
    events = bootstrap.get("events", [])
    current = next((e for e in events if e.get("is_current")), None)
    if current:
        return current.get("id")
    finished = [e for e in events if e.get("finished")]
    if finished:
        return max(e.get("id", 0) for e in finished)
    upcoming = next((e for e in events if e.get("is_next")), None)
    return upcoming.get("id") if upcoming else None


def fetch_all_standings() -> tuple[dict, list[dict]]:
    page = 1
    league = None
    results: list[dict] = []

    while True:
        url = f"{BASE_URL}/leagues-classic/{LEAGUE_ID}/standings/?page_standings={page}"
        payload = fetch_json(url)
        league = league or payload.get("league", {})
        standings = payload.get("standings", {})
        results.extend(standings.get("results", []))

        if not standings.get("has_next"):
            break
        page += 1
        if page > 100:
            raise RuntimeError("Aborting after 100 standings pages; unexpected FPL response.")

    return league or {}, results


def main() -> int:
    print(f"Fetching FPL classic league {LEAGUE_ID}...")
    bootstrap = fetch_json(f"{BASE_URL}/bootstrap-static/")
    league, standings = fetch_all_standings()

    output = {
        "league_id": int(LEAGUE_ID),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "current_gameweek": current_gameweek(bootstrap),
        "league": league,
        "standings": standings,
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(standings)} standings rows to {OUT_FILE}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
