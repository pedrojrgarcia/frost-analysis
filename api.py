import sqlite3

from flask import Flask, jsonify, request
from flask_cors import CORS

DB_FILE = "frost_data.db"

app = Flask(__name__)
CORS(app)


def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


@app.get("/weather")
def weather():
    year_from = request.args.get("year_from", type=int)
    year_to = request.args.get("year_to", type=int)
    conn = get_db()
    rows = conn.execute(
        """
        SELECT date, temp_min, temp_max, temp_mean, humidity, wind_speed, sunshine_duration, cloud_cover
        FROM daily_weather
        WHERE date >= ? AND date <= ?
          AND CAST(substr(date, 6, 2) AS INTEGER) BETWEEN 3 AND 5
        ORDER BY date
        """,
        (f"{year_from}-01-01", f"{year_to}-12-31"),
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.get("/gdd-milestone")
def gdd_milestone():
    year_from = request.args.get("year_from", type=int)
    year_to = request.args.get("year_to", type=int)
    conn = get_db()
    rows = conn.execute(
        """
        SELECT year, MIN(date) AS milestone_date
        FROM daily_gdd
        WHERE gdd_accumulated >= 40
          AND year BETWEEN ? AND ?
        GROUP BY year
        ORDER BY year
        """,
        (year_from, year_to),
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


if __name__ == "__main__":
    app.run(port=5000, debug=True)
