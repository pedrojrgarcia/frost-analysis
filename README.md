# frost-analysis

Checks spring frost risk for a vineyard plot.

It downloads historical hourly weather for one location from
[Open-Meteo](https://open-meteo.com) (free, no account), estimates budbreak
(DWD observations where available, otherwise Growing Degree Days), counts frost
nights after budbreak and classifies them as radiation or advection frost.
The browser shows a frost calendar (December–October), a frost table per year
and the terrain of the plot (from a 1 m elevation model).

First test plot: Kröv, Moselle, Germany (49.98444 N, 7.09784 E).

## How it works

```
fetch.py       -> hourly_weather -> analyze.py -> hourly_daily  \
                (frost_data.db)                   (frost_data.db) \
fetch_dwd.py   -> data/dwd_budbreak.csv                            -> api.py (Flask, port 5001) -> frontend (React, port 5173)
terrain.py     -> data/terrain.json                               /
```

1. `fetch.py` downloads hourly weather from Open-Meteo into the SQLite database `frost_data.db` (download only, no calculations).
2. `analyze.py` reads the hourly weather and computes one row per day (and per night) in `hourly_daily`.
3. `api.py` is the **backend**. It reads `hourly_daily` and sends the data to the frontend.
4. `frontend/` is the **frontend**. It shows the calendar, the frost table and the plot box in the browser.

`fetch_dwd.py` and `terrain.py` are optional steps that write files in `data/`. The API reads them when they exist.

## What is in this folder

| File / folder | What it does |
|---|---|
| `fetch.py` | Downloads hourly weather from Open-Meteo into the table `hourly_weather` |
| `analyze.py` | Computes day and night values from `hourly_weather` into the table `hourly_daily` |
| `fetch_dwd.py` | Downloads DWD grapevine budbreak observations near the plot into `data/dwd_budbreak.csv` |
| `terrain.py` | Computes terrain characteristics of the plot from DGM1 tiles into `data/terrain.json` |
| `api.py` | Backend: Flask API that serves the data |
| `frontend/` | Frontend: React + Vite + TypeScript calendar |
| `data/` | Plot Shapefile, DGM1 tiles (`data/dgm1/`) and the files written by `fetch_dwd.py` and `terrain.py` |
| `frost_data.db` | Local SQLite database (not in Git, rebuilt by `fetch.py` + `analyze.py`) |
| `requirements.txt` | Python libraries |
| `PROJECT_DESCRIPTION.md` | The original project description |
| `docs/superpowers/specs/` | Design notes for each step |

## What you need

- Python 3
- Node.js and npm (for the frontend)
- Internet connection for the downloads

## One-time setup

**Python** (from the project folder):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Frontend:**

```bash
cd frontend
npm install
cd ..
```

Run `source .venv/bin/activate` again every time you open a new terminal.

## Step 1 — Fetch hourly weather from Open-Meteo

```bash
python fetch.py --lat <latitude> --lon <longitude> [--years <N>]
```

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--lat`  | yes      | —       | Latitude of the location |
| `--lon`  | yes      | —       | Longitude of the location |
| `--years`| no       | `25`    | How many years back from January 1st of the current year |

**Example — Kröv, last 25 years:**

```bash
python fetch.py --lat 49.98444 --lon 7.09784
```

- All years and all months, hourly, time zone `Europe/Berlin`. One model per variable:

  | Variable | Model |
  |---|---|
  | `temperature_2m`, `relative_humidity_2m` | ERA5-Land (about 9 km) |
  | `wind_speed_10m`, `sunshine_duration`, `cloud_cover` | ERA5 (about 25 km) |

  ERA5-Land has no data for wind, sunshine and cloud cover in the Open-Meteo archive
  (the API returns only empty values), so these three come from ERA5.
- One request per year and model, 1 second pause between requests.
- On HTTP 429 (rate limit) it waits 60 s and retries, doubling the wait each time,
  up to 5 attempts, then exits with a message.
- Years already in `hourly_weather` (last expected day of the year stored) are skipped,
  so an interrupted run continues where it stopped. The current year is always fetched again.
  To refetch a year, delete its rows from `hourly_weather`.
- If `hourly_weather` has a different set of columns than expected, it is recreated and all years are downloaded again.
- Re-running is safe: existing hours are replaced.

## Step 2 — Compute day and night values

```bash
python analyze.py
```

Reads `hourly_weather` and rebuilds the table `hourly_daily` (one row per date):

| Group | Columns | Meaning |
|---|---|---|
| Day (00:00–24:00) | `tmax`, `tmin` | Highest and lowest hourly temperature (°C) |
| | `gdd`, `gdd_accumulated` | `max(0, (tmax + tmin) / 2 − 7.5)`, added up from January 1st of each year |
| | `humidity_mean` | Mean relative humidity (%) |
| | `wind_max` | Highest hourly wind speed (km/h) |
| | `sunshine_hours` | Sunshine duration (hours) |
| | `cloud_mean` | Mean cloud cover (%) |
| Night (20:00 previous day to 08:00, assigned to the morning date) | `night_min`, `night_min_hour` | Lowest hourly temperature and the hour it happened |
| | `night_wind_mean` | Mean wind speed (km/h) |
| | `night_cloud_mean` | Mean cloud cover (%) |
| | `frost_type` | Only for frost nights (`night_min` ≤ 0 °C): `radiation` or `advection`, see below. Empty without frost |

- The night uses the hourly values 20:00–07:00. It is empty for the first date fetched
  (no evening before) and for nights with missing hours.
- The **GDD-40 milestone** (first day the sum reaches 40, base 7.5 °C from January 1st) is used
  as the budbreak estimate. The base 7.5 °C was chosen by comparing with 19 years of DWD
  budbreak observations at Ürzig (7 km from Kröv): mean error about ±11 days. The common base of
  10 °C gave budbreak about three weeks too late. The base is `GDD_BASE` in `analyze.py`.
- **Frost type** of a frost night (`night_min` ≤ 0 °C):
  - `radiation` if `night_wind_mean` < 10 km/h at 10 m height (about 5 km/h near the buds) **and** `night_cloud_mean` < 20 %
  - `advection` for every other frost night
  - empty when there is no frost

  The two limits are `RADIATION_MAX_WIND` and `RADIATION_MAX_CLOUD` at the top of `analyze.py`.
- Safe to re-run. Run it again after every new fetch.

## Step 3 — Start the backend (API)

In **terminal 1**, from the project folder:

```bash
source .venv/bin/activate
python api.py
```

The API runs on [http://localhost:5001](http://localhost:5001). Leave this terminal open.

| Endpoint | Returns |
|---|---|
| `/days?year_from=2017&year_to=2024` | All day and night values, December 2016 through October 2024 (November is left out) |
| `/gdd-milestone?year_from=2017&year_to=2024` | First day GDD ≥ 40, per year |
| `/dwd-budbreak?year_from=2017&year_to=2024` | DWD budbreak dates from `data/dwd_budbreak.csv` (empty if the file does not exist) |
| `/frost-summary?year_from=2017&year_to=2024` | Frost count per year, see below |
| `/terrain` | Terrain of the plot from `data/terrain.json` (error 404 with a message if `terrain.py` has not been run) |

**Frost summary (per year).** Shown as a table above the calendar.

- **Budbreak date:** the DWD date of the nearest station (Ürzig for Kröv) from `data/dwd_budbreak.csv`
  if the file has that year (source `DWD <station>`), otherwise the GDD-40 milestone of the model (source `model`).
  The source used is returned and shown.
- **Counted nights:** nights after the budbreak date up to 30 June. A night belongs to its morning date,
  so the night of the budbreak day itself is not counted.
- **Returned:** `year`, `budbreak_date`, `budbreak_source`, `budbreak_station_distance_km`
  (the `distance_km` of the DWD station from `data/dwd_budbreak.csv`, i.e. its distance to the plot centre; empty when the source is `model`), `frost_nights` (≤ 0 °C),
  `severe_frost_nights` (≤ −1.5 °C, also counted as frost nights), `radiation_nights`, `advection_nights`,
  `coldest_night_date` and `coldest_night_temp`. Years without a budbreak date have empty values.
- Run `analyze.py` again after updating, because `/days` and `/frost-summary` need the column `frost_type`.

`year_from` and `year_to` are required. Without them the API answers with error 400.

## Step 4 — Start the frontend

In **terminal 2**:

```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

- Choose a year range at the top.
- Each year shows a calendar from December of the previous year through October
  (winter frost Dec–Feb, spring frost Mar–May, autumn frost Oct) with frost and GDD highlights.
- On the right: a "Plot" box with the terrain of the plot (needs `terrain.py`; "steep slope" from 30 % mean slope),
  a summary line and a bar chart "Frost nights after budbreak per year" (one bar per year of the selected range,
  split into radiation and advection nights; years with at least one severe frost night (≤ −1.5 °C) have a dark
  outline and a ▼ above the bar; years without frost show "0"; years without a budbreak date show "–"),
  the summary line says e.g. "2015–2025: 8 of 11 years with frost after budbreak, 2 with severe frost (2017, 2022).
  6 radiation and 9 advection nights.",
  a table with the frost count per year (budbreak source with the DWD station distance, e.g. `DWD Ürzig (7.3 km)`),
  a short explanation of radiation and advection frost, and the day panel.
- Click a day to see all its day and night values (including the frost type of a frost night) in the side panel.

The backend (step 3) must be running, or the page shows an error.

To stop the backend or the frontend, press `Ctrl + C` in its terminal.

### Highlight legend

| Colour | Meaning |
|--------|---------|
| Light blue | `night_min ≤ 0°C` (frost night) |
| Dark blue | `night_min ≤ −1.5°C` (severe frost night) |
| Red | First day GDD accumulation ≥ 40 (estimated budbreak) |
| Yellow | `(Tmax + Tmin) / 2 > 7.5°C` (GDD > 0) |
| Green | DWD budbreak date of the nearest station. On the same day as red: red tile with a green ring |

## Optional — DWD budbreak observations

```bash
python fetch_dwd.py --lat <latitude> --lon <longitude> [--radius <km>]
```

Example for Kröv: `python fetch_dwd.py --lat 49.98444 --lon 7.09784`

- Downloads the DWD grapevine budbreak dates ("Austrieb Beginn", annual reporters) and the station list from `opendata.dwd.de`.
- Keeps the stations within `--radius` km (default `30`) and writes `data/dwd_budbreak.csv`
  with `year, station, distance_km, height_m, budbreak_date`, sorted by year, then distance.
- If a station reports several ripening classes in one year, the earliest date is used.
  Values marked doubtful, invalid or wrong by the DWD are left out.
- If no station is within the radius, it says so and writes no file.
- Independent of the database; it is meant for calibrating the GDD-40 budbreak estimate.

## Optional — Terrain of the plot

Needs the extra libraries `rasterio`, `geopandas` and `numpy` (in `requirements.txt`):

```bash
pip install -r requirements.txt
python terrain.py [--plot data/Weinbergsflaeche_Kroev.shp] [--dem data/dgm1]
```

| Option | Default | Description |
|---|---|---|
| `--plot` | `data/Weinbergsflaeche_Kroev.shp` | Shapefile with the plot outline (attributes `name` and `ort` are read) |
| `--dem` | `data/dgm1` | Folder with the DGM1 GeoTIFF tiles (1 m, EPSG:25832) |

- Merges the tiles, reprojects the plot to the DEM's coordinate system and keeps only the cells inside the plot.
  The plot must be fully covered by the tiles, otherwise the script says so and stops.
- Slope and aspect are computed on the whole merged DEM first (so cells at the plot edge are correct), then masked to the plot.
- Writes `data/terrain.json` with: `name`, `ort`, `area_ha`, `elevation_min_m`, `elevation_max_m`, `elevation_mean_m`,
  `elevation_diff_m`, `slope_mean_deg`, `slope_mean_percent`, `aspect_mean_deg`, `aspect_compass` (N, NE, E, SE, S, SW, W, NW), plus `crs`, `cells` and `dem_tiles`.
  - `slope_mean_percent` is the mean of the per-cell slope in percent (not the percent of the mean angle).
  - The aspect is the direction the slope faces, as a circular mean. Flat cells are left out.
- The frontend shows these values in a "Plot" box above the frost table. A mean slope of 30 % or more is labelled "steep slope".
- Source of the tiles: DGM1 RLP 1 m (2023), ©GeoBasis-DE / LVermGeoRP, dl-de/by-2-0
  (`https://geobasis-rlp.de/data/dgm1/current/tif/`).

## Querying the data directly

```bash
sqlite3 frost_data.db
```

```sql
-- Frost nights
SELECT date, night_min, night_min_hour FROM hourly_daily WHERE night_min <= 0 ORDER BY date;

-- GDD milestone per year (first day accumulated GDD ≥ 40)
SELECT substr(date, 1, 4) AS year, MIN(date) AS milestone_date
FROM hourly_daily WHERE gdd_accumulated >= 40
GROUP BY year ORDER BY year;

-- Total hours and days
SELECT COUNT(*) FROM hourly_weather;
SELECT COUNT(*) FROM hourly_daily;
```

## What is done

- **Hourly weather** for all years and months, time zone `Europe/Berlin`, one fixed model per variable
  (ERA5-Land for temperature and humidity, ERA5 for wind, sunshine and cloud cover) — `fetch.py`.
- **Day and night values**: Tmax, Tmin, GDD (base 7.5 °C), humidity, wind, sunshine, cloud cover, and per night
  (20:00–08:00) the minimum temperature, its hour, mean wind and mean cloud cover — `analyze.py`.
- **Frost type** of every frost night (≤ 0 °C): radiation frost (wind < 10 km/h at 10 m height, about 5 km/h near the buds,
  and cloud cover < 20 %) or advection frost — `analyze.py`.
- **Budbreak**: DWD observations of the nearest station (Ürzig) where available, otherwise the GDD-40 model
  with base 7.5 °C, calibrated against 19 years of DWD data — `fetch_dwd.py`, `api.py`.
- **Frost count per year**: frost nights (≤ 0 °C), severe frost nights (≤ −1.5 °C), radiation and advection nights and
  the coldest night, counted after budbreak up to 30 June — `/frost-summary`, table in the frontend.
- **Winter and autumn frost**: the calendar covers December of the previous year through October, so winter frost
  (Dec–Feb), spring frost (Mar–May) and autumn frost (Oct) are visible.
- **Terrain of the plot** from the DGM1 Rheinland-Pfalz (1 m): area, elevation, slope, aspect — `terrain.py`,
  "Plot" box in the frontend with a "steep slope" label from 30 % mean slope.
- **Frontend**: calendar with frost, GDD and DWD budbreak highlights, frost table with explanation of radiation and
  advection frost, day panel with all day and night values.

## Limitations

- ERA5 weather cells are 9–25 km wide, so this is the weather of the area, not of the exact plot.
- Temperature is at 2 m. On clear, calm nights the buds (0.5–1.5 m) can be 1–3 °C colder.
- The budbreak estimate (base 7.5 °C, threshold 40) is calibrated against DWD observations at Ürzig only
  (19 years, mean error about ±11 days). The DWD does not state the grape variety; Riesling is likely.
- Results should be checked against local stations (Agrarmeteorologie RLP) and known frost years (2017, 2024).
