import sqlite3

from flask import Flask, jsonify, request
from flask_cors import CORS

DB_FILE = "frost_data.db"

WEATHER_TABLE = "daily_weather"
GDD_TABLE = "daily_gdd"

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


@app.get("/weather")
def weather():
    parsed = parse_args()
    if not isinstance(parsed[0], int):
        return parsed
    year_from, year_to = parsed
    conn = get_db()
    rows = query(
        conn,
        WEATHER_TABLE,
        f"""
        SELECT date, temp_min, temp_max, temp_mean, humidity, wind_speed, sunshine_duration, cloud_cover
        FROM {WEATHER_TABLE}
        WHERE date >= ? AND date <= ?
          AND CAST(substr(date, 6, 2) AS INTEGER) BETWEEN 3 AND 5
        ORDER BY date
        """,
        (f"{year_from}-01-01", f"{year_to}-12-31"),
    )
    conn.close()
    return jsonify(rows)


@app.get("/gdd")
def gdd():
    parsed = parse_args()
    if not isinstance(parsed[0], int):
        return parsed
    year_from, year_to = parsed
    conn = get_db()
    rows = query(
        conn,
        GDD_TABLE,
        f"""
        SELECT date, year, gdd_daily, gdd_accumulated
        FROM {GDD_TABLE}
        WHERE year BETWEEN ? AND ?
          AND CAST(substr(date, 6, 2) AS INTEGER) BETWEEN 3 AND 5
        ORDER BY date
        """,
        (year_from, year_to),
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
        GDD_TABLE,
        f"""
        SELECT year, MIN(date) AS milestone_date
        FROM {GDD_TABLE}
        WHERE gdd_accumulated >= 40
          AND year BETWEEN ? AND ?
        GROUP BY year
        ORDER BY year
        """,
        (year_from, year_to),
    )
    conn.close()
    return jsonify(rows)


if __name__ == "__main__":
    app.run(port=5001, debug=True)
