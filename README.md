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

## Step 2 — Compute GDD

```bash
python analyze.py
```

Reads `frost_data.db` and populates a `daily_gdd` table with daily and accumulated Growing Degree Days (degrees above 10°C, from January 1st each year). Safe to re-run.

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

Then open [http://localhost:5173](http://localhost:5173) in your browser. Select a year range to see the March–May calendar with frost and GDD highlights.

### Highlight legend

| Colour | Meaning |
|--------|---------|
| Light blue | `temp_min < 0°C` |
| Dark blue | `temp_min < -1.5°C` |
| Red | First day GDD accumulation ≥ 40 |

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
