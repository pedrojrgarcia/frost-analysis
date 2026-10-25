# Frost Analysis — Design Spec

## Overview

A one-time Python script that fetches historical daily weather data for a given location from [open-meteo.com](https://open-meteo.com) and stores it in a local SQLite database for ad-hoc SQL analysis.

## Design Decisions

- **Single script** (`fetch.py`), no modules or frameworks — chosen for simplicity as a one-off tool
- **SQLite** (`frost_data.db`) — zero-config local database, gitignored
- **One external dependency**: `requests`; rest is stdlib (`sqlite3`, `argparse`, `datetime`)
- **No API key** needed — open-meteo is free and public

## CLI Interface

```
python fetch.py --lat <lat> --lon <lon> [--years 25]
```

| Argument  | Required | Default | Description |
|-----------|----------|---------|-------------|
| `--lat`   | yes      | —       | Latitude |
| `--lon`   | yes      | —       | Longitude |
| `--years` | no       | `25`    | Years back from Jan 1 of the current year. `0` = this calendar year only. |

Date range: from `January 1st of (current_year - years)` to yesterday.

## Fetching Strategy

One HTTP GET per calendar year to `https://archive-api.open-meteo.com/v1/archive`, iterating from `start_year` to `current_year`. Progress is printed per year. Each year is committed to SQLite before moving to the next, so partial results are preserved on interruption.

## Database Schema

Table: `daily_weather`

| column            | type | notes                       |
|-------------------|------|-----------------------------|
| date              | TEXT | ISO `YYYY-MM-DD`, primary key |
| lat               | REAL | from CLI                    |
| lon               | REAL | from CLI                    |
| temp_min          | REAL | °C                          |
| temp_max          | REAL | °C                          |
| humidity          | REAL | %                           |
| wind_speed        | REAL | km/h                        |
| sunshine_duration | REAL | seconds                     |
| cloud_cover       | REAL | %                           |

Created with `CREATE TABLE IF NOT EXISTS`. Rows written with `INSERT OR REPLACE` — re-running the script is safe.

## open-meteo API Fields

Endpoint: `https://archive-api.open-meteo.com/v1/archive`

Daily variables requested: `temperature_2m_min`, `temperature_2m_max`, `relative_humidity_2m_max`, `wind_speed_10m_max`, `sunshine_duration`, `cloud_cover_mean`. All fetched under `timezone=UTC`.

## File Structure

```
frost-analysis/
├── fetch.py            # the script
├── frost_data.db       # created on first run (gitignored)
├── requirements.txt    # requests
├── README.md
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-10-25-frost-analysis-design.md
```
