# frost-analysis

Checks spring frost risk for a vineyard plot.

It downloads historical weather data for one location from
[Open-Meteo](https://open-meteo.com) (free, no account), computes Growing
Degree Days (GDD) to estimate budbreak, and shows a frost-risk calendar
for March–May in the browser.

First test plot: Kröv, Moselle, Germany (49.98444 N, 7.09784 E).

## How it works

```
fetch.py   -> daily_weather  \
                              -> frost_data.db -> api.py (Flask, port 5001) -> frontend (React, port 5173)
analyze.py -> daily_gdd      /
```

1. `fetch.py` downloads the weather from Open-Meteo into the SQLite database `frost_data.db`.
2. `analyze.py` reads the weather and computes the GDD for every day.
3. `api.py` is the **backend**. It reads the database and sends the data to the frontend.
4. `frontend/` is the **frontend**. It shows the calendar in the browser.

## What is in this folder

| File / folder | What it does |
|---|---|
| `fetch.py` | Downloads daily weather from Open-Meteo into `frost_data.db` |
| `analyze.py` | Computes daily and accumulated GDD into `frost_data.db` |
| `api.py` | Backend: Flask API that serves the data |
| `frontend/` | Frontend: React + Vite + TypeScript calendar |
| `frost_data.db` | Local SQLite database (not in Git, rebuilt by `fetch.py` + `analyze.py`) |
| `requirements.txt` | Python libraries |
| `PROJECT_DESCRIPTION.md` | The original project description |
| `docs/superpowers/specs/` | Design notes for each step |

## What you need

- Python 3
- Node.js and npm (for the frontend)
- Internet connection for the first download

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

## Step 1 — Fetch weather data from Open-Meteo

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

- It downloads one year per request and prints a line per year.
- Results go to the table `daily_weather` in `frost_data.db`.
- Re-running is safe: existing days are replaced.

**Data stored per day:** min, max and mean temperature (°C), max humidity (%),
max wind speed (km/h), sunshine duration (seconds) and mean cloud cover (%).

## Step 2 — Compute GDD

```bash
python analyze.py
```

- Reads `daily_weather` and fills the table `daily_gdd`.
- GDD per day = `max(0, mean temperature − 10 °C)`, added up from January 1st each year.
- The **GDD-40 milestone** (first day the sum reaches 40) is used as the budbreak estimate.
  It is a starting value and must be calibrated with DWD phenology data.
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
| `/weather?year_from=2017&year_to=2024` | Daily weather, March–May |
| `/gdd?year_from=2017&year_to=2024` | Daily and accumulated GDD, March–May |
| `/gdd-milestone?year_from=2017&year_to=2024` | First day GDD ≥ 40, per year |

`year_from` and `year_to` are required. Without them the API answers with error 400.

## Step 4 — Start the frontend

In **terminal 2**:

```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

- Choose a year range at the top.
- Each year shows a March–May calendar with frost and GDD highlights.
- Click a day to see all its data in the side panel.

The backend (step 3) must be running, or the page shows an error.

To stop the backend or the frontend, press `Ctrl + C` in its terminal.

### Highlight legend

| Colour | Meaning |
|--------|---------|
| Light blue | `temp_min < 0°C` (frost) |
| Dark blue | `temp_min < -1.5°C` (severe frost) |
| Red | First day GDD accumulation ≥ 40 (estimated budbreak) |
| Yellow | `temp_mean > 10°C` |

## Querying the data directly

```bash
sqlite3 frost_data.db
```

```sql
-- Days with frost
SELECT date, temp_min FROM daily_weather WHERE temp_min < 0 ORDER BY date;

-- GDD milestone per year (first day accumulated GDD ≥ 40)
SELECT year, MIN(date) AS milestone_date
FROM daily_gdd WHERE gdd_accumulated >= 40
GROUP BY year ORDER BY year;

-- Total rows
SELECT COUNT(*) FROM daily_weather;
```

## What is left to do

The current data is a first version: **daily** values, in **UTC**, and
Open-Meteo picks the weather model itself ("best match", which can change
between years). The next steps are:

1. **Hourly weather, one fixed model per value**, all years and all months,
   time zone `Europe/Berlin`:

   | Value | Open-Meteo variable | Model | Used for |
   |---|---|---|---|
   | Temperature at 2 m | `temperature_2m` | ERA5-Land (about 9 km) | Budbreak, frost, severe frost, winter and autumn frost |
   | Wind at 10 m | `wind_speed_10m` | ERA5-Land (about 9 km) | Radiation or advection frost |
   | Cloud cover | `cloud_cover` | ERA5 (about 25 km), ERA5-Land has no clouds | Radiation or advection frost |

2. **Frost nights** from 20:00 to 08:00 local time, counted only after budbreak:
   - frost: night minimum ≤ 0 °C
   - severe frost: night minimum ≤ −1.5 °C
   - **radiation frost**: frost night with wind < 5 km/h and cloud cover < 20 %
   - **advection frost**: every other frost night
   - also check winter frost (December–February) and autumn frost (October)
3. **Elevation of the plot** (height, slope, aspect) for a grid of points inside the plot:
   - **DGM1 Rheinland-Pfalz (1 m)** for Kröv (downloaded tiles)
   - **Copernicus DEM (90 m)** through the Open-Meteo Elevation API as the fallback for plots elsewhere
   - needs the plot outline as a KML file
4. **Results**: a table per year, a chart and a short summary.
   Check that 2017 and 2024 show up as frost years.

## Limitations

- ERA5 weather cells are 9–25 km wide, so this is the weather of the area, not of the exact plot.
- Temperature is at 2 m. On clear, calm nights the buds (0.5–1.5 m) can be 1–3 °C colder.
- The GDD-40 budbreak threshold is not calibrated yet (needs DWD phenology data).
- Results should be checked against local stations (Agrarmeteorologie RLP) and known frost years (2017, 2024).
