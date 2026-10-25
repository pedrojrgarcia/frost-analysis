# Frost Analysis — Google Earth Engine Data Source

## Context

A second weather source is added next to Open-Meteo so both can be compared for the same location. Dataset: ERA5-Land daily (`ECMWF/ERA5_LAND/DAILY_AGGR`) from Google Earth Engine (GEE).

```
fetch.py        -> daily_weather      \
                                       analyze.py -> daily_gdd      -> api.py (source=open_meteo) \
fetch-google.py -> daily_weather_gee  /            -> daily_gdd_gee -> api.py (source=gee)        -> UI
```

## `fetch-google.py`

`python fetch-google.py --lat --lon --project <gcp-project> [--years 25]`

Requires `earthengine authenticate` once. One `getRegion` request per year on a point at 11132 m scale; rows are committed per year with `INSERT OR REPLACE`.

Table `daily_weather_gee`: `date` (PK), `lat`, `lon`, `temp_min`, `temp_max`, `temp_mean`, `humidity`, `wind_speed`, `solar_radiation`.

| Column | Derivation |
|--------|-----------|
| temp_min / max / mean | `temperature_2m_min/max`, `temperature_2m`, Kelvin to °C |
| humidity | Magnus formula from mean temperature and `dewpoint_temperature_2m`, capped at 100 % |
| wind_speed | `sqrt(u² + v²) * 3.6` km/h from the daily mean 10 m components |
| solar_radiation | `surface_solar_radiation_downwards_sum`, J/m² |

No sunshine duration or cloud cover exists in ERA5-Land; the API returns them as `null`.

## `analyze.py`

Loops over a `SOURCES` list (`open_meteo`: `daily_weather` -> `daily_gdd`, `gee`: `daily_weather_gee` -> `daily_gdd_gee`). Same formula for both: `gdd_daily = max(0, temp_mean - 10)` with a running total from Jan 1. Days with null `temp_mean` are skipped. A source whose weather table is missing is skipped.

## `api.py`

`/weather`, `/gdd` and `/gdd-milestone` accept `source` (`open_meteo` default, or `gee`). Table names come from a fixed dict. Unknown source or missing `year_from`/`year_to` returns 400. A missing table returns `[]`. `/weather` returns the same fields for both sources, with `sunshine_duration` and `cloud_cover` null for `gee`.

## Frontend

- `api.ts`: `Source` type, `source` argument on every fetch helper, `res.ok` check, nullable sunshine and cloud cover.
- `App.tsx`: loads both sources, selection is `{ source, day }`.
- `CalendarView.tsx`: per year, one March–May grid per source side by side; shared legend.
- `DayDetail.tsx`: shows the source, "n/a" for null fields, GDD of the selected source.
