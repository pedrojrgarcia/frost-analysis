# frost-analysis

Downloads historical daily weather data for a given location from [open-meteo.com](https://open-meteo.com), computes Growing Degree Days (GDD), and displays a frost-risk calendar via a React frontend.

Data collected per day: min/max/mean temperature, humidity, wind speed, sunshine duration, cloud cover.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Step 1 — Fetch data

```bash
python fetch.py --lat <latitude> --lon <longitude> [--years <N>]
```

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--lat`  | yes      | —       | Latitude of the location |
| `--lon`  | yes      | —       | Longitude of the location |
| `--years`| no       | `25`    | How many years back from January 1st of the current year |

**Example — last 25 years for Madrid:**
```bash
python fetch.py --lat 40.4168 --lon -3.7038
```

Results are saved to `frost_data.db` (SQLite). Re-running is safe — existing rows are replaced.

## Step 1b — Fetch Google Earth Engine data (optional)

Fetches ERA5-Land daily data from Google Earth Engine into a separate table, `daily_weather_gee`, so it can be compared with Open-Meteo.

**One-time setup** — the Google Cloud project is `frost-vineyard`. It needs the Earth Engine API enabled and must be registered for Earth Engine at https://code.earthengine.google.com/register.

```bash
source .venv/bin/activate
pip install -r requirements.txt    # includes earthengine-api
earthengine authenticate           # opens a browser, sign in once
```

Check that it works (should print `1`):

```bash
python -c "import ee; ee.Initialize(project='frost-vineyard'); print(ee.Number(1).getInfo())"
```

**Fetch the data** (use the same coordinates as for `fetch.py`):

```bash
python fetch-google.py --lat <latitude> --lon <longitude> --project frost-vineyard [--years <N>]
```

**Example — last 25 years for Madrid:**
```bash
python fetch-google.py --lat 40.4168 --lon -3.7038 --project frost-vineyard
```

Same `--lat`, `--lon` and `--years` arguments as `fetch.py`, plus the required `--project`. Re-running is safe. Afterwards run `python analyze.py` (Step 2) so the GDD table for this source is computed.

Differences from Open-Meteo: ERA5-Land is a reanalysis (not raw satellite pixels), has no sunshine duration or cloud cover (shown as n/a), humidity is derived from temperature and dewpoint, wind speed is the daily mean of the wind components (Open-Meteo stores the daily max), and the most recent days may be missing.

## Step 2 — Compute GDD

```bash
python analyze.py
```

Reads `frost_data.db` and populates `daily_gdd` (from `daily_weather`) and `daily_gdd_gee` (from `daily_weather_gee`) with daily and accumulated Growing Degree Days (degrees above 10°C, from January 1st each year). A source whose weather table does not exist is skipped. Safe to re-run.

## Step 3 — Run the visualization

Open two terminals:

**Terminal 1 — API server:**
```bash
python api.py
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser. Select a year range to see the March–May calendars with frost and GDD highlights: for each year, Open-Meteo on the left and Google Earth Engine on the right. Click a day in either calendar to see its data in the side panel.

The API endpoints (`/weather`, `/gdd`, `/gdd-milestone`) take `year_from`, `year_to` and an optional `source` (`open_meteo` by default, or `gee`).

### Highlight legend

| Colour | Meaning |
|--------|---------|
| Light blue | `temp_min < 0°C` |
| Dark blue | `temp_min < -1.5°C` |
| Red | First day GDD accumulation ≥ 40 |
| Yellow | `temp_mean > 10°C` |

## Querying the data directly

```sql
-- Days with frost risk
SELECT date, temp_min FROM daily_weather WHERE temp_min < 0 ORDER BY date;

-- GDD milestone per year (first day accumulated GDD ≥ 40)
SELECT year, MIN(date) AS milestone_date
FROM daily_gdd WHERE gdd_accumulated >= 40
GROUP BY year ORDER BY year;

-- Total rows
SELECT COUNT(*) FROM daily_weather;
```
