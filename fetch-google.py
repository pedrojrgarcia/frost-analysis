import argparse
import math
import sqlite3
import sys
import time
from datetime import date, datetime, timedelta, timezone

import ee

DB_FILE = "frost_data.db"
DATASET = "ECMWF/ERA5_LAND/DAILY_AGGR"
SCALE_M = 11132  # ERA5-Land native resolution

BANDS = [
    "temperature_2m",
    "temperature_2m_min",
    "temperature_2m_max",
    "dewpoint_temperature_2m",
    "u_component_of_wind_10m",
    "v_component_of_wind_10m",
    "surface_solar_radiation_downwards_sum",
]

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS daily_weather_gee (
    date             TEXT PRIMARY KEY,
    lat              REAL,
    lon              REAL,
    temp_min         REAL,
    temp_max         REAL,
    temp_mean        REAL,
    humidity         REAL,
    wind_speed       REAL,
    solar_radiation  REAL
)
"""

INSERT_SQL = """
INSERT OR REPLACE INTO daily_weather_gee
    (date, lat, lon, temp_min, temp_max, temp_mean, humidity, wind_speed, solar_radiation)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
"""


def kelvin_to_celsius(k):
    return None if k is None else k - 273.15


def relative_humidity(temp_c, dewpoint_c):
    """Magnus formula, result in %."""
    if temp_c is None or dewpoint_c is None:
        return None
    a, b = 17.625, 243.04
    rh = 100 * math.exp(a * dewpoint_c / (b + dewpoint_c)) / math.exp(a * temp_c / (b + temp_c))
    return min(rh, 100.0)


def wind_speed_kmh(u, v):
    if u is None or v is None:
        return None
    return math.hypot(u, v) * 3.6


def fetch_year(point, year, end_date):
    start = f"{year}-01-01"
    last = end_date if end_date.year == year else date(year, 12, 31)
    end = (last + timedelta(days=1)).isoformat()  # filterDate end is exclusive
    collection = ee.ImageCollection(DATASET).filterDate(start, end).select(BANDS)
    table = collection.getRegion(point, SCALE_M).getInfo()
    header, records = table[0], table[1:]
    return [dict(zip(header, record)) for record in records]


def daily_rows(lat, lon, records):
    rows = []
    for rec in records:
        day = datetime.fromtimestamp(rec["time"] / 1000, tz=timezone.utc).date().isoformat()
        temp_mean = kelvin_to_celsius(rec["temperature_2m"])
        dewpoint = kelvin_to_celsius(rec["dewpoint_temperature_2m"])
        rows.append((
            day,
            lat,
            lon,
            kelvin_to_celsius(rec["temperature_2m_min"]),
            kelvin_to_celsius(rec["temperature_2m_max"]),
            temp_mean,
            relative_humidity(temp_mean, dewpoint),
            wind_speed_kmh(rec["u_component_of_wind_10m"], rec["v_component_of_wind_10m"]),
            rec["surface_solar_radiation_downwards_sum"],
        ))
    return rows


def main():
    parser = argparse.ArgumentParser(description="Fetch ERA5-Land daily data from Google Earth Engine into SQLite.")
    parser.add_argument("--lat", type=float, required=True, help="Latitude")
    parser.add_argument("--lon", type=float, required=True, help="Longitude")
    parser.add_argument("--project", required=True, help="Google Cloud project ID registered for Earth Engine")
    parser.add_argument("--years", type=int, default=25, help="Years back from Jan 1 of current year (default: 25)")
    args = parser.parse_args()

    try:
        ee.Initialize(project=args.project)
    except Exception as e:
        sys.exit(f"Could not initialize Earth Engine ({e}). Run `earthengine authenticate` and check --project.")

    today = date.today()
    start_year = today.year - args.years
    end_date = today - timedelta(days=1)
    point = ee.Geometry.Point(args.lon, args.lat)

    conn = sqlite3.connect(DB_FILE)
    conn.execute(CREATE_TABLE_SQL)
    conn.commit()

    total = 0
    for year in range(start_year, today.year + 1):
        print(f"Fetching {year}...", end=" ", flush=True)
        records = fetch_year(point, year, end_date)
        rows = daily_rows(args.lat, args.lon, records)
        conn.executemany(INSERT_SQL, rows)
        conn.commit()
        print(f"{len(rows)} days inserted.")
        total += len(rows)
        time.sleep(0.5)

    conn.close()
    print(f"Done. Total: {total} days stored in {DB_FILE}")


if __name__ == "__main__":
    main()
