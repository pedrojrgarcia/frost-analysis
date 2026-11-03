import csv
import json
import sqlite3
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

DB_FILE = "frost_data.db"

TABLE = "hourly_daily"
DWD_FILE = Path("data") / "dwd_budbreak.csv"
TERRAIN_FILE = Path("data") / "terrain.json"

GDD_MILESTONE = 40  # accumulated GDD (base set in analyze.py) that counts as budbreak
FROST_TEMP = 0.0
SEVERE_FROST_TEMP = -1.5
FROST_END = "06-30"  # frost nights are counted up to this day

app = Flask(__name__)
CORS(app)


def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def parse_args():
    """Returns (year_from, year_to) or a (response, status) error tuple."""
    year_from = request.args.get("year_from", type=int)
    year_to = request.args.get("year_to", type=int)
    if year_from is None or year_to is None:
        return jsonify({"error": "year_from and year_to are required integers"}), 400
    return year_from, year_to


def query(conn, table, sql, params):
    exists = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (table,)
    ).fetchone()
    if not exists:
        return []
    return [dict(r) for r in conn.execute(sql, params).fetchall()]


def frost_type_missing(conn):
    """Error response when hourly_daily was built before the frost_type column existed."""
    columns = [r[1] for r in conn.execute(f"PRAGMA table_info({TABLE})")]
    if columns and "frost_type" not in columns:
        conn.close()
        return jsonify({"error": f"{TABLE} has no frost_type column. Run analyze.py again."}), 503
    return None


def load_dwd(year_from, year_to):
    if not DWD_FILE.exists():
        return []
    with open(DWD_FILE, newline="", encoding="utf-8") as f:
        rows = [
            {
                "year": int(r["year"]),
                "station": r["station"],
                "distance_km": float(r["distance_km"]),
                "height_m": int(r["height_m"]),
                "budbreak_date": r["budbreak_date"],
            }
            for r in csv.DictReader(f)
        ]
    return [r for r in rows if year_from <= r["year"] <= year_to]


@app.get("/days")
def days():
    """All day and night values from December of year_from - 1 through October of year_to."""
    parsed = parse_args()
    if not isinstance(parsed[0], int):
        return parsed
    year_from, year_to = parsed
    conn = get_db()
    error = frost_type_missing(conn)
    if error:
        return error
    rows = query(
        conn,
        TABLE,
        f"""
        SELECT date, tmax, tmin, gdd, gdd_accumulated, humidity_mean, wind_max, sunshine_hours, cloud_mean,
               night_min, night_min_hour, night_wind_mean, night_cloud_mean, frost_type
        FROM {TABLE}
        WHERE date >= ? AND date <= ?
          AND substr(date, 6, 2) <> '11'
        ORDER BY date
        """,
        (f"{year_from - 1}-12-01", f"{year_to}-10-31"),
    )
    conn.close()
    return jsonify(rows)


@app.get("/gdd-milestone")
def gdd_milestone():
    parsed = parse_args()
    if not isinstance(parsed[0], int):
        return parsed
    year_from, year_to = parsed
    conn = get_db()
    rows = query(
        conn,
        TABLE,
        f"""
        SELECT CAST(substr(date, 1, 4) AS INTEGER) AS year, MIN(date) AS milestone_date
        FROM {TABLE}
        WHERE gdd_accumulated >= 40
          AND CAST(substr(date, 1, 4) AS INTEGER) BETWEEN ? AND ?
        GROUP BY year
        ORDER BY year
        """,
        (year_from, year_to),
    )
    conn.close()
    return jsonify(rows)


@app.get("/dwd-budbreak")
def dwd_budbreak():
    parsed = parse_args()
    if not isinstance(parsed[0], int):
        return parsed
    year_from, year_to = parsed
    return jsonify(load_dwd(year_from, year_to))


@app.get("/frost-summary")
def frost_summary():
    """Per year: budbreak and the frost nights after it, up to 30 June."""
    parsed = parse_args()
    if not isinstance(parsed[0], int):
        return parsed
    year_from, year_to = parsed

    nearest = {}  # year -> nearest DWD station row
    for r in load_dwd(year_from, year_to):
        if r["year"] not in nearest or r["distance_km"] < nearest[r["year"]]["distance_km"]:
            nearest[r["year"]] = r

    conn = get_db()
    error = frost_type_missing(conn)
    if error:
        return error
    summary = []
    for year in range(year_from, year_to + 1):
        rows = query(
            conn,
            TABLE,
            f"""
            SELECT date, gdd_accumulated, night_min, frost_type
            FROM {TABLE}
            WHERE date >= ? AND date <= ?
            ORDER BY date
            """,
            (f"{year}-01-01", f"{year}-{FROST_END}"),
        )
        if year in nearest:
            budbreak = nearest[year]["budbreak_date"]
            source = f"DWD {nearest[year]['station']}"
            station_distance = nearest[year]["distance_km"]
        else:
            budbreak = next((r["date"] for r in rows if r["gdd_accumulated"] >= GDD_MILESTONE), None)
            source = "model" if budbreak else None
            station_distance = None

        entry = {
            "year": year,
            "budbreak_date": budbreak,
            "budbreak_source": source,
            "budbreak_station_distance_km": station_distance,
            "frost_nights": None,
            "severe_frost_nights": None,
            "radiation_nights": None,
            "advection_nights": None,
            "coldest_night_date": None,
            "coldest_night_temp": None,
        }
        if budbreak:
            # a night belongs to its morning date; the night of the budbreak day itself is before it
            nights = [r for r in rows if r["date"] > budbreak and r["night_min"] is not None]
            frost = [r for r in nights if r["night_min"] <= FROST_TEMP]
            entry.update(
                frost_nights=len(frost),
                severe_frost_nights=sum(r["night_min"] <= SEVERE_FROST_TEMP for r in frost),
                radiation_nights=sum(r["frost_type"] == "radiation" for r in frost),
                advection_nights=sum(r["frost_type"] == "advection" for r in frost),
            )
            if nights:
                coldest = min(nights, key=lambda r: r["night_min"])
                entry.update(coldest_night_date=coldest["date"], coldest_night_temp=coldest["night_min"])
        summary.append(entry)
    conn.close()
    return jsonify(summary)


@app.get("/terrain")
def terrain():
    if not TERRAIN_FILE.exists():
        return jsonify({"error": f"{TERRAIN_FILE} does not exist yet. Run terrain.py first."}), 404
    return jsonify(json.loads(TERRAIN_FILE.read_text(encoding="utf-8")))


if __name__ == "__main__":
    app.run(port=5001, debug=True)
