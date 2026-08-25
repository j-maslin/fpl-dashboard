#!/usr/bin/env python3
"""Build the static JSON payload used by the Virtuoso FPL dashboard."""

from __future__ import annotations

import json
import statistics
import time
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

LEAGUE_ID = 1112007
BASE_URL = "https://fantasy.premierleague.com/api"
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "data" / "fpl-data.json"
USER_AGENT = "Mozilla/5.0 (compatible; VirtuosoFPLDashboard/3.0; GitHubPages)"


def get_json(path: str, retries: int = 3) -> dict:
    """Fetch and decode a public FPL JSON endpoint with a small retry policy."""
    url = path if path.startswith("http") else f"{BASE_URL}{path}"
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    last_error: Exception | None = None

    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                return json.load(response)
        except Exception as error:  # noqa: BLE001 - network failures are retried and reported
            last_error = error
            if attempt < retries - 1:
                time.sleep(1.5 * (attempt + 1))

    raise RuntimeError(f"Failed GET {url}: {last_error}")


def safe_json(path: str) -> dict:
    """Fetch optional manager data without failing the whole dashboard build."""
    try:
        return get_json(path)
    except Exception as error:  # noqa: BLE001 - a single unavailable entry should not stop deployment
        print(f"Warning: {path}: {error}")
        return {}


def safe_int(value: object) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def current_gameweek(bootstrap: dict) -> dict:
    """Return the current event, or the latest completed event between gameweeks."""
    events = bootstrap.get("events", [])
    current = next((event for event in events if event.get("is_current")), None)
    if current:
        return current

    finished = [event for event in events if event.get("finished")]
    if finished:
        return finished[-1]

    upcoming = next((event for event in events if event.get("is_next")), None)
    if upcoming:
        return upcoming

    return events[0] if events else {"id": 1, "name": "Gameweek 1"}


def fetch_league_rows() -> tuple[dict, list[dict]]:
    """Fetch every standings page for the configured classic league."""
    page = 1
    rows: list[dict] = []
    league: dict = {}

    while True:
        data = get_json(f"/leagues-classic/{LEAGUE_ID}/standings/?page_standings={page}")
        if not league:
            league = data.get("league", {})

        standings = data.get("standings", {})
        rows.extend(standings.get("results", []))

        if not standings.get("has_next"):
            break

        page += 1
        if page > 50:
            raise RuntimeError("Stopped after 50 standings pages to avoid an unexpected loop")

    return league, rows


def active_chip_for_gameweek(history: dict, picks: dict, gameweek: int) -> str | None:
    if picks.get("active_chip"):
        return picks.get("active_chip")

    for chip in history.get("chips", []):
        if chip.get("event") == gameweek:
            return chip.get("name")

    return None


def player_name(player: dict) -> str:
    return player.get("web_name") or f"{player.get('first_name', '')} {player.get('second_name', '')}".strip()


def competition_ranks(total_pairs: list[tuple[int, int]]) -> dict[int, int]:
    """Return competition ranks, preserving ties at the same cumulative score."""
    ranks: dict[int, int] = {}
    previous_total: int | None = None
    current_rank = 0

    for index, (total, entry_id) in enumerate(sorted(total_pairs, reverse=True), start=1):
        if total != previous_total:
            current_rank = index
            previous_total = total
        ranks[entry_id] = current_rank

    return ranks


def manager_snapshot(row: dict) -> dict:
    return {
        "team": row.get("team"),
        "manager": row.get("manager"),
    }


def main() -> None:
    bootstrap = get_json("/bootstrap-static/")
    gameweek_object = current_gameweek(bootstrap)
    gameweek = safe_int(gameweek_object.get("id")) or 1
    league, raw_standings = fetch_league_rows()

    players = {player["id"]: player for player in bootstrap.get("elements", [])}
    teams = {
        team["id"]: team.get("short_name") or team.get("name")
        for team in bootstrap.get("teams", [])
    }

    manager_data: dict[int, dict] = {}
    ownership: Counter[int] = Counter()
    captains: Counter[int] = Counter()

    for index, raw_row in enumerate(raw_standings, start=1):
        entry_id = raw_row["entry"]
        history = safe_json(f"/entry/{entry_id}/history/")
        picks = safe_json(f"/entry/{entry_id}/event/{gameweek}/picks/") if gameweek else {}
        manager_data[entry_id] = {"history": history, "picks": picks}

        for pick in picks.get("picks", []):
            element_id = pick.get("element")
            if not element_id:
                continue
            ownership[element_id] += 1
            if pick.get("is_captain"):
                captains[element_id] += 1

        if index < len(raw_standings):
            time.sleep(0.08)

    table: list[dict] = []
    for raw_row in raw_standings:
        entry_id = raw_row["entry"]
        history = manager_data[entry_id]["history"]
        picks = manager_data[entry_id]["picks"]
        entry_history = picks.get("entry_history", {})
        rank = safe_int(raw_row.get("rank"))
        last_rank = safe_int(raw_row.get("last_rank")) or rank

        table.append(
            {
                "entry": entry_id,
                "rank": rank,
                "last_rank": last_rank,
                "movement": last_rank - rank,
                "team": raw_row.get("entry_name", ""),
                "manager": raw_row.get("player_name", ""),
                "gw_points": safe_int(raw_row.get("event_total")),
                "total": safe_int(raw_row.get("total")),
                "active_chip": active_chip_for_gameweek(history, picks, gameweek),
                "bench_points": safe_int(entry_history.get("points_on_bench")),
                "hit_cost": safe_int(entry_history.get("event_transfers_cost")),
                "transfers": safe_int(entry_history.get("event_transfers")),
            }
        )

    table.sort(key=lambda row: (row["rank"], -row["total"], row["team"].lower()))
    manager_count = len(table)
    leader = table[0] if table else {}
    runner_up = table[1] if len(table) > 1 else {}
    last_place = table[-1] if table else {}
    gameweek_king = max(table, default={}, key=lambda row: (row.get("gw_points", 0), -row.get("rank", 9999)))
    lowest_score = min(table, default={}, key=lambda row: (row.get("gw_points", 0), row.get("rank", 9999)))

    climbers = [row for row in table if row.get("movement", 0) > 0]
    fallers = [row for row in table if row.get("movement", 0) < 0]
    biggest_climber = max(climbers, default={}, key=lambda row: (row.get("movement", 0), row.get("gw_points", 0)))
    biggest_faller = min(fallers, default={}, key=lambda row: (row.get("movement", 0), -row.get("gw_points", 0)))

    bench_pain_row = max(table, default={}, key=lambda row: row.get("bench_points", 0))
    biggest_hit_row = max(table, default={}, key=lambda row: row.get("hit_cost", 0))
    active_chip_rows = [row for row in table if row.get("active_chip")]
    active_chip_breakdown = Counter(row["active_chip"] for row in active_chip_rows)

    all_events = sorted(
        {
            history_row.get("event")
            for data in manager_data.values()
            for history_row in data["history"].get("current", [])
            if history_row.get("event")
        }
    )
    latest_six = all_events[-6:]
    latest_four = all_events[-4:]

    history_by_entry: dict[int, dict[int, dict]] = {}
    for entry_id, data in manager_data.items():
        history_by_entry[entry_id] = {
            history_row["event"]: history_row
            for history_row in data["history"].get("current", [])
            if history_row.get("event")
        }

    form_candidates: list[tuple[int, dict]] = []
    for row in table:
        form_points = sum(
            safe_int(history_by_entry[row["entry"]].get(event, {}).get("points"))
            for event in latest_four
        )
        form_candidates.append((form_points, row))

    form_points, form_leader = max(
        form_candidates,
        default=(0, {}),
        key=lambda item: (item[0], -item[1].get("rank", 9999)),
    )

    rank_by_gameweek: dict[int, dict[int, int]] = {}
    for event in latest_six:
        totals: list[tuple[int, int]] = []
        for row in table:
            history_row = history_by_entry[row["entry"]].get(event)
            if history_row:
                totals.append((safe_int(history_row.get("total_points")), row["entry"]))
        rank_by_gameweek[event] = competition_ranks(totals)

    top_six = table[:6]
    performance_series = []
    position_series = []
    for row in top_six:
        performance_series.append(
            {
                "name": row["team"],
                "values": [
                    history_by_entry[row["entry"]].get(event, {}).get("points")
                    for event in latest_six
                ],
            }
        )
        position_series.append(
            {
                "name": row["team"],
                "values": [rank_by_gameweek.get(event, {}).get(row["entry"]) for event in latest_six],
            }
        )

    gameweek_winners = []
    for event in reversed(all_events[-4:]):
        candidates: list[tuple[int, int, dict]] = []
        for row in table:
            history_row = history_by_entry[row["entry"]].get(event)
            if history_row:
                candidates.append((safe_int(history_row.get("points")), -row["rank"], row))

        if candidates:
            points, _, winner = max(candidates, key=lambda item: (item[0], item[1]))
            gameweek_winners.append(
                {
                    "gameweek": event,
                    "points": points,
                    "team": winner["team"],
                    "manager": winner["manager"],
                }
            )

    def player_info(player_id: int) -> dict:
        player = players.get(player_id, {})
        return {
            "id": player_id,
            "name": player_name(player),
            "team": teams.get(player.get("team"), ""),
            "points": safe_int(player.get("event_points")),
        }

    captain_popularity = []
    for player_id, count in captains.most_common(4):
        info = player_info(player_id)
        info.update(
            count=count,
            percent=(count * 100 / manager_count) if manager_count else 0,
        )
        captain_popularity.append(info)

    most_captained: dict = {}
    if captains:
        player_id, count = captains.most_common(1)[0]
        most_captained = player_info(player_id)
        most_captained.update(
            count=count,
            percent=(count * 100 / manager_count) if manager_count else 0,
        )

    most_owned: dict = {}
    if ownership:
        player_id, count = ownership.most_common(1)[0]
        most_owned = player_info(player_id)
        most_owned.update(
            count=count,
            percent=(count * 100 / manager_count) if manager_count else 0,
        )

    differential_candidates = []
    for player_id, count in ownership.items():
        ownership_percent = (count * 100 / manager_count) if manager_count else 0
        if count and ownership_percent <= 25:
            info = player_info(player_id)
            info.update(count=count, percent=ownership_percent)
            differential_candidates.append(info)

    top_differential = max(
        differential_candidates,
        default={},
        key=lambda player: (player.get("points", 0), -player.get("percent", 100)),
    )
    highest_scoring_player = max(
        (player_info(player_id) for player_id in players),
        default={},
        key=lambda player: player.get("points", 0),
    )

    gameweek_scores = [row["gw_points"] for row in table]
    average_gameweek = round(sum(gameweek_scores) / manager_count, 1) if manager_count else 0
    median_gameweek = round(float(statistics.median(gameweek_scores)), 1) if gameweek_scores else 0
    lead_gap = max(0, leader.get("total", 0) - runner_up.get("total", 0)) if runner_up else 0
    league_spread = max(0, leader.get("total", 0) - last_place.get("total", 0)) if last_place else 0

    form_payload = {
        **manager_snapshot(form_leader),
        "points": form_points,
        "gameweeks": len(latest_four),
    }
    bench_pain_payload = {
        **manager_snapshot(bench_pain_row),
        "points": bench_pain_row.get("bench_points", 0),
    }
    biggest_hit_payload = {
        **manager_snapshot(biggest_hit_row),
        "points": biggest_hit_row.get("hit_cost", 0),
    }

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "league": {
            "id": LEAGUE_ID,
            "name": league.get("name") or "Virtuoso FPL",
        },
        "gameweek": {
            "id": gameweek,
            "name": gameweek_object.get("name"),
            "finished": bool(gameweek_object.get("finished")),
            "is_current": bool(gameweek_object.get("is_current")),
            "deadline_time": gameweek_object.get("deadline_time"),
        },
        "summary": {
            "manager_count": manager_count,
            "average_gw": average_gameweek,
            "median_gw": median_gameweek,
            "lead_gap": lead_gap,
            "league_spread": league_spread,
            "active_chips": len(active_chip_rows),
            "active_chip_breakdown": dict(active_chip_breakdown),
            "history_gameweeks": len(latest_six),
            "has_rank_movement": any(row.get("movement", 0) != 0 for row in table),
            "leader": {
                **manager_snapshot(leader),
                "total": leader.get("total"),
            },
            "gw_king": {
                **manager_snapshot(gameweek_king),
                "gw_points": gameweek_king.get("gw_points"),
            },
            "bad_week": {
                **manager_snapshot(lowest_score),
                "gw_points": lowest_score.get("gw_points"),
            },
            "biggest_climber": {
                **manager_snapshot(biggest_climber),
                "movement": biggest_climber.get("movement", 0),
            },
            "biggest_faller": {
                **manager_snapshot(biggest_faller),
                "movement": biggest_faller.get("movement", 0),
            },
            "bench_pain": bench_pain_payload,
            "biggest_hit": biggest_hit_payload,
            "form_leader": form_payload,
            "manager_of_month": form_payload,
        },
        "standings": table,
        "players": {
            "most_captained": most_captained,
            "most_owned": most_owned,
            "top_differential": top_differential,
            "captain_popularity": captain_popularity,
            "highest_scoring": highest_scoring_player,
        },
        "charts": {
            "performance": {
                "labels": [f"GW {event}" for event in latest_six],
                "series": performance_series,
            },
            "positions": {
                "labels": [f"GW {event}" for event in latest_six],
                "series": position_series,
            },
        },
        "gameweek_winners": gameweek_winners,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH} with {manager_count} managers for GW {gameweek}")


if __name__ == "__main__":
    main()
