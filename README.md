# frost-analysis

Downloads historical daily weather data for a given location from [open-meteo.com](https://open-meteo.com) and stores it in a local SQLite database for analysis.

Data collected per day: min/max temperature, humidity, wind speed, sunshine duration, cloud cover.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Usage

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

**Example — just this year:**
```bash
python fetch.py --lat 40.4168 --lon -3.7038 --years 0
```

Results are saved to `frost_data.db` (SQLite). Re-running is safe — existing rows are replaced.

## Querying the data

```sql
-- First 10 rows
SELECT date, temp_min, temp_max FROM daily_weather ORDER BY date LIMIT 10;

-- Days with frost risk (min temp below 0°C)
SELECT date, temp_min FROM daily_weather WHERE temp_min < 0 ORDER BY date;

-- Total rows
SELECT COUNT(*) FROM daily_weather;
```
