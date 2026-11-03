import argparse
import sqlite3
import sys
import time
from datetime import date, timedelta

import requests

API_URL = "https://archive-api.open-meteo.com/v1/archive"
DB_FILE = "frost_data.db"

# One model per variable. ERA5-Land (about 9 km) has no wind, sunshine or cloud
# data in the Open-Meteo archive (checked: all values null), so those come from ERA5.
SOURCES = [
    ("era5_land", ["temperature_2m", "relative_humidity_2m"]),
    ("era5", ["wind_speed_10m", "sunshine_duration", "cloud_cover"]),
]
VARIABLES = [v for _, variables in SOURCES for v in variables]

CREATE_TABLE_SQL = f"""
CREATE TABLE IF NOT EXISTS hourly_weather (
    time                TEXT PRIMARY KEY,
    date                TEXT,
    lat                 REAL,
    lon                 REAL,
    {" REAL,\n    ".join(VARIABLES)} REAL
)
"""

INSERT_SQL = f"""
INSERT OR REPLACE INTO hourly_weather (time, date, lat, lon, {", ".join(VARIABLES)})
VALUES ({", ".join("?" * (4 + len(VARIABLES)))})
"""

RETRY_WAIT = 60
MAX_ATTEMPTS = 5
PAUSE = 1


def get_with_retry(params, timeout):
    """GET the API; on HTTP 429 wait 60 s, doubling, up to MAX_ATTEMPTS attempts."""
    wait = RETRY_WAIT
    for attempt in range(1, MAX_ATTEMPTS + 1):
        response = requests.get(API_URL, params=params, timeout=timeout)
        if response.status_code != 429:
            response.raise_for_status()
            return response
        if attempt == MAX_ATTEMPTS:
            break
        print(f"HTTP 429 (rate limit), retrying in {wait} s (attempt {attempt}/{MAX_ATTEMPTS})...", flush=True)
        time.sleep(wait)
        wait *= 2
    sys.exit(f"Open-Meteo rate limit (HTTP 429) still active after {MAX_ATTEMPTS} attempts. "
             "Wait a while and run the script again.")


def fetch_year(lat, lon, year, end_date):
    """Returns (times, {variable: values}) for one year, one request per model."""
    start = f"{year}-01-01"
    end = end_date.isoformat() if end_date.year == year else f"{year}-12-31"
    times = None
    values = {}
    for model, variables in SOURCES:
        response = get_with_retry({
            "latitude": lat,
            "longitude": lon,
            "start_date": start,
            "end_date": end,
            "hourly": ",".join(variables),
            "models": model,
            "timezone": "Europe/Berlin",
        }, timeout=120)
        hourly = response.json()["hourly"]
        if times is None:
            times = hourly["time"]
        elif hourly["time"] != times:
            sys.exit(f"Time axes of {model} and the previous model differ for {year}.")
        for variable in variables:
            values[variable] = hourly[variable]
        time.sleep(PAUSE)
    return times, values


def hourly_rows(lat, lon, times, values):
    # time looks like "2024-04-05T03:00"; skip hours without any value (newest days)
    rows = []
    for i, t in enumerate(times):
        row = [values[v][i] for v in VARIABLES]
        if all(x is None for x in row):
            continue
        rows.append((t[:13].replace("T", " ") + ":00", t[:10], lat, lon, *row))
    return rows


def check_available(year, rows):
    for k, variable in enumerate(VARIABLES):
        if rows and all(r[4 + k] is None for r in rows):
            model = next(m for m, vs in SOURCES if variable in vs)
            sys.exit(f"{variable} has no data in model {model} for {year}.")


def prepare_table(conn):
    columns = [r[1] for r in conn.execute("PRAGMA table_info(hourly_weather)")]
    expected = ["time", "date", "lat", "lon", *VARIABLES]
    if columns and columns != expected:
        print("hourly_weather has an old layout; recreating it (all years are downloaded again).")
        conn.execute("DROP TABLE hourly_weather")
    conn.execute(CREATE_TABLE_SQL)
    conn.commit()


def main():
    parser = argparse.ArgumentParser(description="Fetch hourly weather from Open-Meteo into SQLite (download only).")
    parser.add_argument("--lat", type=float, required=True, help="Latitude")
    parser.add_argument("--lon", type=float, required=True, help="Longitude")
    parser.add_argument("--years", type=int, default=25, help="Years back from Jan 1 of current year (default: 25)")
    args = parser.parse_args()

    today = date.today()
    start_year = today.year - args.years
    end_date = today - timedelta(days=1)

    conn = sqlite3.connect(DB_FILE)
    prepare_table(conn)

    total = 0
    for year in range(start_year, today.year + 1):
        last_day = end_date.isoformat() if end_date.year == year else f"{year}-12-31"
        # a year counts as present when its last expected day is stored
        if conn.execute("SELECT 1 FROM hourly_weather WHERE date = ? LIMIT 1", (last_day,)).fetchone():
            print(f"Skipping {year}: already in hourly_weather.")
            continue
        print(f"Fetching {year}...", end=" ", flush=True)
        times, values = fetch_year(args.lat, args.lon, year, end_date)
        rows = hourly_rows(args.lat, args.lon, times, values)
        check_available(year, rows)
        conn.executemany(INSERT_SQL, rows)
        conn.commit()
        print(f"{len(rows)} hours inserted.")
        total += len(rows)

    conn.close()
    print(f"Done. {total} hours fetched into {DB_FILE}")


if __name__ == "__main__":
    main()
