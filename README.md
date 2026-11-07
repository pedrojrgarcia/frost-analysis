# frost-analysis

Checks the spring frost risk of a vineyard plot with free data.

- **Weather:** hourly data from [Open-Meteo](https://open-meteo.com) (ERA5-Land / ERA5, free, no account)
- **Budbreak:** DWD observations where available, otherwise a heat-sum model (GDD)
- **Frost:** frost nights after budbreak, as radiation or advection frost
- **Terrain:** height, slope and aspect of the plot from the 1 m elevation model DGM1
- **Browser view:** frost calendar, frost chart and table per year, plot box

First test plot: Kröv, Moselle (49.98444 N, 7.09784 E).

## How it works

```
fetch.py      -> frost_data.db (hourly_weather) -> analyze.py -> frost_data.db (hourly_daily) \
fetch_dwd.py  -> data/dwd_budbreak.csv                                                       -> api.py -> frontend
terrain.py    -> data/terrain.json                                                           /
```

| File | What it does |
|---|---|
| `fetch.py` | Downloads hourly weather into `frost_data.db` |
| `analyze.py` | Computes day and night values, GDD and frost type |
| `fetch_dwd.py` | Downloads DWD budbreak dates near the plot (optional) |
| `terrain.py` | Computes the terrain of the plot from DGM1 (optional) |
| `api.py` | Backend (Flask, port 5001) |
| `frontend/` | Browser view (React, port 5173) |
| `data/` | Plot Shapefile, DGM1 tiles (`data/dgm1/`), `dwd_budbreak.csv`, `terrain.json` |
| `frost_data.db` | Local SQLite database (rebuilt by `fetch.py` + `analyze.py`) |
| `PROJECT_DESCRIPTION.md`, `docs/superpowers/specs/` | Original project description and design notes |

## Setup (once)

You need Python 3, Node.js and npm.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd frontend && npm install && cd ..
```

Run `source .venv/bin/activate` again in every new terminal.

## Run it

**1. Download the weather** (example: Kröv, last 25 years)

```bash
python fetch.py --lat 49.98444 --lon 7.09784 --years 25
```

**2. Calculate day and night values**

```bash
python analyze.py
```

**3. Optional: DWD budbreak and terrain** (see the sections below)

```bash
python fetch_dwd.py --lat 49.98444 --lon 7.09784
python terrain.py
```

**4. Start the backend** (terminal 1, leave it open)

```bash
python api.py
```

**5. Start the frontend** (terminal 2)

```bash
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Stop a server with `Ctrl + C`.

Run `analyze.py` again after every new download.

## Method in short

**Weather** (`fetch.py`): hourly, all months, time zone `Europe/Berlin`, one fixed model per value, so all years are comparable.

| Value | Model |
|---|---|
| Temperature, humidity | ERA5-Land (about 9 km) |
| Wind, sunshine, cloud cover | ERA5 (about 25 km). ERA5-Land has no values for these in Open-Meteo |

- One request per year and model, 1 second pause between requests.
- On HTTP 429 (rate limit) it waits 60 s and retries, doubling the wait, up to 5 attempts, then stops with a message.
- Years already complete in `hourly_weather` are skipped, so an interrupted run continues where it stopped.
  The current year is always fetched again. To refetch a year, delete its rows from `hourly_weather`.
- If `hourly_weather` has different columns than expected, it is recreated and all years are downloaded again.
- Re-running is safe: existing hours are replaced.

**Day and night values** (`analyze.py`)

- **Day** (00:00–24:00): Tmax, Tmin, GDD, humidity, wind, sunshine, clouds.
- **Night** (20:00 previous day to 08:00, stored on the morning date): lowest temperature and its hour, mean wind, mean clouds.
  Nights instead of calendar days, because a calendar day mixes two nights, and the frost type needs the wind and clouds of the night.
- The night uses the hourly values 20:00–07:00. It is empty for the first date fetched (no evening before) and for nights with missing hours.

Columns of `hourly_daily` (one row per date):

| Group | Columns | Meaning |
|---|---|---|
| Day | `tmax`, `tmin` | Highest and lowest hourly temperature (°C) |
| | `gdd`, `gdd_accumulated` | Daily GDD and the sum from 1 January |
| | `humidity_mean`, `wind_max`, `sunshine_hours`, `cloud_mean` | Mean humidity (%), highest wind (km/h), sunshine (h), mean clouds (%) |
| Night | `night_min`, `night_min_hour` | Lowest temperature and its hour |
| | `night_wind_mean`, `night_cloud_mean` | Mean wind (km/h) and clouds (%) |
| | `frost_type` | `radiation` or `advection` for frost nights, empty otherwise |

**Budbreak**

- DWD date of the nearest station **in the Moselle valley** (Enkirch, Ürzig or Wintrich; `BUDBREAK_STATIONS` in `api.py`) when it exists.
  Stations outside the valley (e.g. Wittlich) bud about two weeks later and would hide frosts, so they are not used.
- Otherwise the model: `GDD = max(0, (Tmax + Tmin) / 2 − 7.5)`, added up from 1 January. Budbreak = first day with a sum of 40.
- The base 7.5 °C was chosen by comparing with 19 years of DWD data at Ürzig (mean error about ±11 days).
  The common base of 10 °C was about three weeks too late. Setting: `GDD_BASE` in `analyze.py`.

**Frost**

- Frost night: night minimum ≤ 0 °C. Severe: ≤ −1.5 °C.
- Counted only after budbreak, up to 31 May. The night of the budbreak day itself is not counted
  (a night belongs to its morning date). Severe nights are also counted as frost nights.
- Years without a budbreak date have empty values in the frost count.
- **Radiation frost:** mean night wind < 10 km/h (at 10 m height, about 5 km/h near the buds) **and** clouds < 20 %.
  **Advection frost:** every other frost night. Settings: `RADIATION_MAX_WIND`, `RADIATION_MAX_CLOUD` in `analyze.py`.

## Browser view

- **Dot chart** in the right column, under the bar chart: one dot per frost night after budbreak (blue = radiation, orange = advection),
  ▼ = severe frost year, a 10-year average line (from 10 selected years on), "m" = budbreak from the model.
  Follows the selected years (e.g. 1976–2025 for 50 years).
- **Calendar** per year, December of the previous year to October (winter, spring and autumn frost).
- **Plot box:** area, height, slope, aspect (needs `terrain.py`).
- **Summary line and chart:** frost nights after budbreak per year, split into radiation and advection; ▼ = severe frost.
- **Table:** budbreak date and source (for example `DWD Ürzig (7.3 km)` or `model`), frost counts, coldest night.
- **Day panel:** click a day to see all its values. The panel is at the bottom of the right column (scroll down there).

| Colour | Meaning |
|---|---|
| Light blue | Frost night (≤ 0 °C) |
| Dark blue | Severe frost night (≤ −1.5 °C) |
| Red | Budbreak from the model (GDD ≥ 40) |
| Green | Budbreak observed by the DWD (green ring on red = same day) |
| Yellow | Day with GDD > 0 |

## Optional: DWD budbreak

```bash
python fetch_dwd.py --lat 49.98444 --lon 7.09784 [--radius 30]
```

Downloads DWD grapevine budbreak dates ("Austrieb") and keeps the stations within `--radius` km (default 30).
Writes `data/dwd_budbreak.csv` (`year, station, distance_km, height_m, budbreak_date`), sorted by year, then distance.
`distance_km` is the distance to the plot centre.

- If a station reports several ripening classes in one year, the earliest date is used.
- Values marked doubtful, invalid or wrong by the DWD are left out.
- If no station is within the radius, it says so and writes no file.
- Independent of the database. Used for the budbreak date and to calibrate the model.

## Optional: terrain of the plot

```bash
python terrain.py [--plot data/Weinbergsflaeche_Kroev.shp] [--dem data/dgm1]
```

Reads the plot Shapefile (attributes `name`, `ort`) and the DGM1 tiles (1 m, EPSG:25832) and writes `data/terrain.json`.

- Merges the tiles and reprojects the plot to the DGM1 coordinate system. The plot must be fully covered by the tiles,
  otherwise the script says so and stops.
- Slope and aspect are computed on the whole merged DGM1 first (so cells at the plot edge are correct), then cut to the plot.
- Fields: `name`, `ort`, `area_ha`, `elevation_min_m`, `elevation_max_m`, `elevation_mean_m`, `elevation_diff_m`,
  `slope_mean_deg`, `slope_mean_percent`, `aspect_mean_deg`, `aspect_compass` (N, NE, E, SE, S, SW, W, NW), `crs`, `cells`, `dem_tiles`.
  - `slope_mean_percent` is the mean of the per-cell slope in percent (not the percent of the mean angle).
  - The aspect is a circular mean of the direction the slope faces. Flat cells are left out.
- The plot box labels a mean slope of 30 % or more as "steep slope".
- Kröv result: 7.72 ha, 103.7–184.8 m (mean 136.3 m), mean slope 24.7°, aspect 174° (south). Same as calculated by hand in QGIS.

### Getting the DGM1 tiles

DGM1 is the free 1 m elevation model of Rhineland-Palatinate. It comes in tiles of 1 × 1 km.

1. **Find the tile numbers.** In QGIS, open the plot, click the coordinate system in the bottom right,
   choose **EPSG:25832** (ETRS89 / UTM zone 32N), and move the mouse over the plot.
   The bottom bar shows e.g. `363512, 5538601`. The first 3 digits (east) and the first 4 digits (north)
   are the tile numbers: **363 / 5538**. Check all corners: if the plot crosses a km line, you need more than one tile.
2. **Find the file name.** Tiles are named `dgm1_32_<east>_<north>_1_rp_<year>.tif`.
   Open the list at <https://geobasis-rlp.de/data/dgm1/current/tif/> and search (Cmd + F) for `363_5538`
   to get the full name with the year.
3. **Download** into `data/dgm1/`, for example for Kröv:

   ```bash
   mkdir -p data/dgm1
   curl -o data/dgm1/dgm1_32_363_5538_1_rp_2023.tif https://geobasis-rlp.de/data/dgm1/current/tif/dgm1_32_363_5538_1_rp_2023.tif
   curl -o data/dgm1/dgm1_32_364_5538_1_rp_2023.tif https://geobasis-rlp.de/data/dgm1/current/tif/dgm1_32_364_5538_1_rp_2023.tif
   ```

Source: DGM1 RLP 1 m (2023), ©GeoBasis-DE / LVermGeoRP, dl-de/by-2-0.

## Not in Git

See `.gitignore`. Get these yourself after cloning:

- `frost_data.db`: run `fetch.py` and `analyze.py`
- `data/dgm1/`: download the DGM1 tiles (see above)
- `data/Weinbergsflaeche_Kroev.*`: the plot Shapefile (put it in `data/`)
- everything else in `data/` except `dwd_budbreak.csv`, `terrain.json` and `Traben-Trarbach *.csv` (hourly station data from wetter.rlp.de, Agrarmeteorologie RLP, station Traben-Trarbach)
- `data/*.qgz`, `presentation/`: personal files

## API

All endpoints except `/terrain` need `year_from` and `year_to` (otherwise error 400).

| Endpoint | Returns |
|---|---|
| `/days` | Day and night values, December to October |
| `/station-days` | Station Traben-Trarbach (from `data/Traben-Trarbach *.csv`): Tmin/Tmax 2 m, GDD from 1 January, night minimum at 2 m and 20 cm, mean wind 2.5 m |
| `/gdd-milestone` | Model budbreak (GDD ≥ 40) per year |
| `/dwd-budbreak` | DWD budbreak dates (empty without `data/dwd_budbreak.csv`) |
| `/frost-summary` | Frost count per year (budbreak, source, station distance, frost/severe/radiation/advection nights, coldest night) |
| `/terrain` | Terrain of the plot (404 without `data/terrain.json`) |

Example: `http://localhost:5001/frost-summary?year_from=2015&year_to=2025`

`/frost-summary` fields: `year`, `budbreak_date`, `budbreak_source` (`DWD <station>` or `model`),
`budbreak_station_distance_km` (empty for `model`), `frost_nights`, `severe_frost_nights`, `radiation_nights`,
`advection_nights`, `coldest_night_date`, `coldest_night_temp`.

## Querying the data directly

```bash
sqlite3 frost_data.db
```

```sql
-- Frost nights
SELECT date, night_min, night_min_hour, frost_type FROM hourly_daily WHERE night_min <= 0 ORDER BY date;

-- Model budbreak per year (first day accumulated GDD ≥ 40)
SELECT substr(date, 1, 4) AS year, MIN(date) AS budbreak FROM hourly_daily WHERE gdd_accumulated >= 40 GROUP BY year;

-- Number of hours and days
SELECT COUNT(*) FROM hourly_weather;
SELECT COUNT(*) FROM hourly_daily;
```

## Limitations

- Weather cells are 9–25 km wide: the weather of the area, not of the exact plot.
- Temperature is at 2 m. On clear, calm nights the buds (0.5–1.5 m) can be 1–3 °C colder.
- Wind is modelled at 10 m, so the 10 km/h limit is an estimate.
- The budbreak model is calibrated at Ürzig only (19 years, about ±11 days). The DWD does not state the grape variety.
- Check results against local stations (Agrarmeteorologie RLP) and known frost years (2017, 2024).
