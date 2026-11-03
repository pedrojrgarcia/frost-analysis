import sqlite3
from collections import defaultdict
from datetime import date, timedelta

DB_FILE = "frost_data.db"
GDD_BASE = 7.5
FROST_TEMP = 0.0  # frost night: night minimum at or below this (°C)
RADIATION_MAX_WIND = 10  # km/h, mean night wind below this ...
RADIATION_MAX_CLOUD = 20  # %, ... and mean night cloud cover below this: radiation frost
NIGHT_START_HOUR = 20
NIGHT_END_HOUR = 8  # exclusive: the night covers the hourly values 20:00 ... 07:00
NIGHT_HOURS = (24 - NIGHT_START_HOUR) + NIGHT_END_HOUR

CREATE_TABLE_SQL = """
CREATE TABLE hourly_daily (
    date              TEXT PRIMARY KEY,
    tmax              REAL,
    tmin              REAL,
    gdd               REAL,
    gdd_accumulated   REAL,
    humidity_mean     REAL,
    wind_max          REAL,
    sunshine_hours    REAL,
    cloud_mean        REAL,
    night_min         REAL,
    night_min_hour    INTEGER,
    night_wind_mean   REAL,
    night_cloud_mean  REAL,
    frost_type        TEXT
)
"""

INSERT_SQL = """
INSERT INTO hourly_daily
    (date, tmax, tmin, gdd, gdd_accumulated, humidity_mean, wind_max, sunshine_hours, cloud_mean,
     night_min, night_min_hour, night_wind_mean, night_cloud_mean, frost_type)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""


def values(items):
    return [x for x in items if x is not None]


def mean(items):
    items = values(items)
    return sum(items) / len(items) if items else None


def maximum(items):
    items = values(items)
    return max(items) if items else None


def derive_daily(rows):
    """rows: (time, temperature, humidity, wind, sunshine_seconds, cloud) sorted by time."""
    by_date = defaultdict(list)  # date -> [(hour, temp, humidity, wind, sunshine, cloud)]
    for time_str, *rest in rows:
        by_date[time_str[:10]].append((int(time_str[11:13]), *rest))

    # night hours keyed by the morning date they belong to, in chronological order
    night = defaultdict(list)
    for day in sorted(by_date):
        for hour, *rest in by_date[day]:
            if hour < NIGHT_END_HOUR:
                night[day].append((hour, *rest))
            elif hour >= NIGHT_START_HOUR:
                morning = (date.fromisoformat(day) + timedelta(days=1)).isoformat()
                night[morning].append((hour, *rest))

    out = []
    accumulated = 0.0
    current_year = None
    for day in sorted(by_date):
        hours = by_date[day]
        temps = values(h[1] for h in hours)
        if not temps:
            continue
        tmax, tmin = max(temps), min(temps)
        gdd = max(0.0, (tmax + tmin) / 2 - GDD_BASE)
        if day[:4] != current_year:
            current_year, accumulated = day[:4], 0.0
        accumulated += gdd

        sunshine = values(h[4] for h in hours)
        sunshine_hours = sum(sunshine) / 3600 if sunshine else None

        # a night is only used when all its hours (evening before and morning) are present
        n = night.get(day, [])
        if len(n) == NIGHT_HOURS and all(h[1] is not None for h in n):
            n_hour, n_min = min(((h[0], h[1]) for h in n), key=lambda ht: ht[1])
            n_wind, n_cloud = mean(h[3] for h in n), mean(h[5] for h in n)
        else:
            n_hour = n_min = n_wind = n_cloud = None

        frost_type = None
        if n_min is not None and n_min <= FROST_TEMP:
            calm_and_clear = (
                n_wind is not None and n_wind < RADIATION_MAX_WIND
                and n_cloud is not None and n_cloud < RADIATION_MAX_CLOUD
            )
            frost_type = "radiation" if calm_and_clear else "advection"

        out.append((
            day, tmax, tmin, gdd, accumulated,
            mean(h[2] for h in hours), maximum(h[3] for h in hours), sunshine_hours, mean(h[5] for h in hours),
            n_min, n_hour, n_wind, n_cloud, frost_type,
        ))
    return out


def main():
    conn = sqlite3.connect(DB_FILE)
    if not conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'hourly_weather'"
    ).fetchone():
        print("Table hourly_weather not found. Run fetch.py first.")
        return

    rows = conn.execute(
        """
        SELECT time, temperature_2m, relative_humidity_2m, wind_speed_10m, sunshine_duration, cloud_cover
        FROM hourly_weather ORDER BY time
        """
    ).fetchall()
    daily = derive_daily(rows)

    # hourly_daily is fully rebuilt on every run
    conn.execute("DROP TABLE IF EXISTS hourly_daily")
    conn.execute(CREATE_TABLE_SQL)
    conn.executemany(INSERT_SQL, daily)
    conn.commit()
    conn.close()
    print(f"Done. {len(rows)} hours -> {len(daily)} days stored in hourly_daily.")


if __name__ == "__main__":
    main()
