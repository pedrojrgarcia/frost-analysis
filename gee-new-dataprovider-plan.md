# Context

The app currently shows frost risk from one source, Open-Meteo. We want to add Google Earth Engine (GEE) data as a second source and show both side by side, so the two models can be compared for the same location. Decisions made with the user:

- GEE dataset: **ERA5-Land daily** (`ECMWF/ERA5_LAND/DAILY_AGGR`).
- GEE auth: `earthengine authenticate` once, plus a `--project` argument.
- UI: for each year, Open-Meteo calendar on the left and GEE calendar on the right, one shared day-detail panel.

# Data flow after the change

```
fetch.py        -> daily_weather      \
                                       analyze.py -> daily_gdd      -> api.py (source=open_meteo) \
fetch-google.py -> daily_weather_gee  /            -> daily_gdd_gee -> api.py (source=gee)        -> UI (two calendars)
```

All tables live in `frost_data.db`. Existing tables and `fetch.py` stay untouched, so nothing breaks for current data.

# 1. `fetch-google.py` (new)

CLI mirrors `fetch.py`: `python fetch-google.py --lat --lon --project <gcp-project> [--years 25]`. Same year range logic (Jan 1 of `today.year - years` through yesterday), one request per year, commit per year, `INSERT OR REPLACE`, small sleep.

- `ee.Initialize(project=args.project)`; on failure print "run `earthengine authenticate`" and exit.
- Per year: filter `ECMWF/ERA5_LAND/DAILY_AGGR` by date, `getRegion` on `ee.Geometry.Point(lon, lat)` at scale 11132 (ERA5-Land native resolution). One year is at most 366 rows, well under the 5000-element limit.
- Bands used: `temperature_2m` (daily mean), `temperature_2m_min`, `temperature_2m_max`, `dewpoint_temperature_2m`, `u_component_of_wind_10m`, `v_component_of_wind_10m`, `surface_solar_radiation_downwards_sum`.
- Conversions in a `daily_rows()` helper (same shape as in `fetch.py`):
  - Kelvin to °C for the three temperatures.
  - Relative humidity from temperature and dewpoint with the Magnus formula (ERA5-Land has no humidity band).
  - Wind speed = `sqrt(u² + v²) * 3.6` (km/h).
  - Solar radiation J/m² stored as-is, labelled in the column name.
- Table `daily_weather_gee`: `date` TEXT PK, `lat`, `lon`, `temp_min`, `temp_max`, `temp_mean`, `humidity`, `wind_speed`, `solar_radiation`.
- ERA5-Land has no sunshine duration or cloud cover, so those columns do not exist in this table. The API returns them as `null` and the UI shows "n/a".
- Add `earthengine-api` to `requirements.txt`.

Caveats to document in the README: ERA5-Land is a reanalysis, not raw satellite pixels; humidity and wind are derived and wind is a daily mean of components, while Open-Meteo's is a daily max, so the numbers are not like-for-like. It also lags real time by a few days, so the last days may be missing.

# 2. `analyze.py` (modify)

Turn the single hard-coded pipeline into a loop over sources:

```python
SOURCES = [
    {"name": "open_meteo", "weather": "daily_weather",     "gdd": "daily_gdd"},
    {"name": "gee",        "weather": "daily_weather_gee", "gdd": "daily_gdd_gee"},
]
```

- `create_table_sql(gdd_table)`, `compute_gdd_for_year(conn, weather_table, year)` and the insert statement take table names from the source config (names come from this constant list, never from user input).
- Skip a source with a message if its weather table does not exist (so analyze works with only one fetch done).
- Same GDD formula for both: `max(0, temp_mean - 10)`, running total from Jan 1. The GDD-40 milestone stays derived on demand in the API, so there is no extra stored formula.
- Also fix the null case: skip days where `temp_mean` is null instead of counting them as 0 (applies to both sources).
- Output lines prefixed with the source name, e.g. `[gee] 2001: GDD calculated for 365 days.`

# 3. `api.py` (modify)

- Add `SOURCES = {"open_meteo": ("daily_weather", "daily_gdd"), "gee": ("daily_weather_gee", "daily_gdd_gee")}`.
- `/weather`, `/gdd`, `/gdd-milestone` accept `source` (default `open_meteo`, so current clients keep working). Unknown source returns 400. Table names are taken from the dict, never interpolated from the request.
- `/weather` for `gee` selects the same field names the frontend already expects, with `NULL AS sunshine_duration, NULL AS cloud_cover`, so the response shape is identical for both sources.
- Return 400 for missing `year_from` or `year_to` (currently queries "None-01-01").
- If the requested table does not exist (fetch not run yet), return an empty list.

# 4. Frontend

- `api.ts`: add `Source = "open_meteo" | "gee"`; `fetchWeather`, `fetchGdd`, `fetchGddMilestones` take a `source` argument; make `sunshine_duration` and `cloud_cover` `number | null`; check `res.ok` and throw a readable error.
- `App.tsx`: hold state per source (`{weather, gddDays, milestones}` for each), load six requests in one `Promise.all`; `selectedDay` becomes `{ source, day }` so the panel knows which GDD map to use; labels for both sources.
- `CalendarView.tsx`: extract the per-year month grid into a `MonthGrid` component. `CalendarView` renders, for each year, a row with two titled grids ("Open-Meteo" and "Google Earth Engine ERA5-Land"). It takes both datasets and milestone maps as props. `dayColor()` is unchanged and applied to each source's data; the selected border only shows in the grid of the selected source. Legend stays once, at the bottom.
- `DayDetail.tsx`: show the source name in the heading, handle null sunshine and cloud cover ("n/a"), and show GDD from the selected source.
- Layout: two grids of three months fit in about 850px, then the sticky detail panel. If the screen is narrower the row wraps.

# 5. Docs

- New spec `docs/superpowers/specs/2026-10-25-frost-analysis-google-earth-engine.md`, in the same format as the existing specs.
- README: new "Step 1b — Fetch Google Earth Engine data" section (authenticate, `--project`), updated analyze and API descriptions, add yellow to the legend, fix the port in the spec (5001).
- `.gitignore`: add `frontend/node_modules` and `frontend/package-lock.json` handling (ignore node_modules; commit the lockfile).

# Files

Create: `fetch-google.py`, the new spec doc.
Modify: `analyze.py`, `api.py`, `requirements.txt`, `README.md`, `.gitignore`, `frontend/src/api.ts`, `App.tsx`, `CalendarView.tsx`, `DayDetail.tsx`.
Unchanged: `fetch.py`, `frost_data.db` schema for existing tables.

# Verification

1. `pip install -r requirements.txt`, `earthengine authenticate`.
2. `python fetch-google.py --lat 40.4168 --lon -3.7038 --project <id> --years 2`, then in sqlite check `SELECT COUNT(*), MIN(date), MAX(date) FROM daily_weather_gee;` and sanity-check temperatures against `daily_weather` for the same dates (should be within a few degrees).
3. `python analyze.py`: both sources print per-year lines; `daily_gdd_gee` populated; rerun is idempotent. Run with the GEE table removed to confirm it skips cleanly.
4. API with curl: `/weather?year_from=2023&year_to=2024&source=gee`, same for `/gdd` and `/gdd-milestone`; confirm `source=bogus` and missing years return 400, and the default still returns Open-Meteo data.
5. `cd frontend && npx tsc --noEmit`, then `npm run dev` and in the browser check: two calendars per year, clicking a day in either one selects it and fills the panel with that source's data, GEE days show "n/a" for sunshine and cloud cover, year range changes reload both.
