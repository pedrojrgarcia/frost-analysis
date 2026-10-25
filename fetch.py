import argparse
import sqlite3
from datetime import date, timedelta

import requests

API_URL = "https://archive-api.open-meteo.com/v1/archive"
DB_FILE = "frost_data.db"

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS daily_weather (
    date               TEXT PRIMARY KEY,
    lat                REAL,
    lon                REAL,
    temp_min           REAL,
    temp_max           REAL,
    temp_mean          REAL,
    humidity           REAL,
    wind_speed         REAL,
    sunshine_duration  REAL,
    cloud_cover        REAL
)
"""

INSERT_SQL = """
INSERT OR REPLACE INTO daily_weather
    (date, lat, lon, temp_min, temp_max, temp_mean, humidity, wind_speed, sunshine_duration, cloud_cover)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""


def fetch_year(lat, lon, year, end_date):
    start = f"{year}-01-01"
    end = end_date.isoformat() if end_date.year == year else f"{year}-12-31"
    response = requests.get(API_URL, params={
        "latitude": lat,
        "longitude": lon,
        "start_date": start,
        "end_date": end,
        "daily": ",".join([
            "temperature_2m_min",
            "temperature_2m_max",
            "temperature_2m_mean",
            "relative_humidity_2m_max",
            "wind_speed_10m_max",
            "sunshine_duration",
            "cloud_cover_mean",
        ]),
        "timezone": "UTC",
    }, timeout=60)
    response.raise_for_status()
    return response.json()["daily"]


def daily_rows(lat, lon, daily):
    return [
        (
            daily["time"][i],
            lat,
            lon,
            daily["temperature_2m_min"][i],
            daily["temperature_2m_max"][i],
            daily["temperature_2m_mean"][i],
            daily["relative_humidity_2m_max"][i],
            daily["wind_speed_10m_max"][i],
            daily["sunshine_duration"][i],
            daily["cloud_cover_mean"][i],
        )
        for i in range(len(daily["time"]))
    ]


def main():
    parser = argparse.ArgumentParser(description="Fetch historical weather data into SQLite.")
    parser.add_argument("--lat", type=float, required=True, help="Latitude")
    parser.add_argument("--lon", type=float, required=True, help="Longitude")
    parser.add_argument("--years", type=int, default=25, help="Years back from Jan 1 of current year (default: 25)")
    args = parser.parse_args()

    today = date.today()
    start_year = today.year - args.years
    end_date = today - timedelta(days=1)

    conn = sqlite3.connect(DB_FILE)
    conn.execute(CREATE_TABLE_SQL)
    try:
        conn.execute("ALTER TABLE daily_weather ADD COLUMN temp_mean REAL")
    except sqlite3.OperationalError:
        pass  # column already exists
    conn.commit()

    total = 0
    for year in range(start_year, today.year + 1):
        print(f"Fetching {year}...", end=" ", flush=True)
        daily = fetch_year(args.lat, args.lon, year, end_date)
        rows = daily_rows(args.lat, args.lon, daily)
        conn.executemany(INSERT_SQL, rows)
        conn.commit()
        print(f"{len(rows)} days inserted.")
        total += len(rows)

    conn.close()
    print(f"Done. Total: {total} days stored in {DB_FILE}")


if __name__ == "__main__":
    main()
