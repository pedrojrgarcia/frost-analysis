import csv
import json
import sqlite3
from datetime import datetime, timedelta
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
FROST_END = "05-31"  # frost nights are counted up to this day (in 50 years the latest was 2 May)
# DWD stations used for the budbreak date: only those in the Moselle valley near Kröv.
# Stations outside the valley (e.g. Wittlich) bud about two weeks later and would hide frosts.
# Years without a date from these stations use the GDD model.
BUDBREAK_STATIONS = {"Enkirch", "Ürzig", "Wintrich"}

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

    nearest = {}  # year -> nearest DWD station row (valley stations only)
    for r in load_dwd(year_from, year_to):
        if r["station"] not in BUDBREAK_STATIONS:
            continue
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
        if budbreak and rows:  # no weather rows (e.g. before 1976) = no frost count, not 0
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


STATION_FILES = "Traben-Trarbach *.csv"  # hourly CSVs from wetter.rlp.de (Agrarmeteorologie RLP), one per year
STATION_MIN_NIGHT_HOURS = 10  # of the 12 night hours, otherwise the night counts as missing
STATION_MIN_DAY_HOURS = 20  # of the 24 day hours, otherwise Tmin/Tmax/GDD count as missing
STATION_GDD_BASE = 7.5  # same base as analyze.py


def station_value(text):
    text = (text or "").strip().replace(",", ".")
    return None if text in ("", "-") else float(text)


def load_station_hours():
    """All hourly rows of the station files as (datetime, row dict)."""
    hours = []
    for path in sorted(Path("data").glob(STATION_FILES)):
        with open(path, newline="", encoding="latin-1") as f:
            for r in csv.DictReader(f, delimiter=";"):
                hours.append((datetime.strptime(f"{r['Tag']} {r['Stunde']}", "%d.%m.%Y %H:%M"), r))
    return hours


@app.get("/station-days")
def station_days():
    """Station Traben-Trarbach per day: Tmin/Tmax (2 m), GDD from 1 January, and the night before
    (20:00-08:00, stored on the morning date): minimum at 2 m and 20 cm, mean wind at 2.5 m.
    Same months as /days: December of year_from - 1 through October of year_to."""
    parsed = parse_args()
    if not isinstance(parsed[0], int):
        return parsed
    year_from, year_to = parsed
    days = {}
    nights = {}
    for moment, r in load_station_hours():
        if not year_from - 1 <= moment.year <= year_to:
            continue
        day = days.setdefault(moment.date().isoformat(), {"min": [], "max": []})
        low, high = station_value(r.get("MIN_TA200min")), station_value(r.get("MAX_TA200max"))
        if low is not None:
            day["min"].append(low)
        if high is not None:
            day["max"].append(high)
        if moment.hour >= 20:
            morning = (moment + timedelta(days=1)).date()
        elif moment.hour < 8:
            morning = moment.date()
        else:
            continue
        night = nights.setdefault(morning.isoformat(), {"t200": [], "t020": [], "wind": []})
        for key, column in (("t200", "MIN_TA200min"), ("t020", "MIN_TA020min"), ("wind", "AVG_WV200")):
            value = station_value(r.get(column))
            if value is not None:
                night[key].append(value)

    result = []
    accumulated, year = 0.0, None
    for date in sorted(set(days) | set(nights)):
        if date[:4] != year:  # GDD starts again on 1 January
            accumulated, year = 0.0, date[:4]
        d = days.get(date, {"min": [], "max": []})
        n = nights.get(date, {"t200": [], "t020": [], "wind": []})
        tmin = min(d["min"]) if len(d["min"]) >= STATION_MIN_DAY_HOURS else None
        tmax = max(d["max"]) if len(d["max"]) >= STATION_MIN_DAY_HOURS else None
        gdd = max(0.0, (tmax + tmin) / 2 - STATION_GDD_BASE) if tmin is not None and tmax is not None else None
        accumulated += gdd or 0.0  # a missing day adds nothing
        if not f"{year_from - 1}-12-01" <= date <= f"{year_to}-10-31" or date[5:7] == "11":
            continue
        result.append({
            "date": date,
            "tmin": tmin,
            "tmax": tmax,
            "gdd": None if gdd is None else round(gdd, 2),
            "gdd_accumulated": round(accumulated, 2),
            "night_min_2m": min(n["t200"]) if len(n["t200"]) >= STATION_MIN_NIGHT_HOURS else None,
            "night_min_20cm": min(n["t020"]) if len(n["t020"]) >= STATION_MIN_NIGHT_HOURS else None,
            "night_wind_mean": round(sum(n["wind"]) / len(n["wind"]) * 3.6, 1) if n["wind"] else None,  # m/s -> km/h
        })
    return jsonify(result)


@app.get("/terrain")
def terrain():
    if not TERRAIN_FILE.exists():
        return jsonify({"error": f"{TERRAIN_FILE} does not exist yet. Run terrain.py first."}), 404
    return jsonify(json.loads(TERRAIN_FILE.read_text(encoding="utf-8")))


if __name__ == "__main__":
    app.run(port=5001, debug=True)
