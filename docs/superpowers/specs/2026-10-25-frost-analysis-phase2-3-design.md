# Frost Analysis — Phase 2 & 3 Design Spec

## Context

Data Collection (Phase 1) is complete: `fetch.py` populates `frost_data.db` with a `daily_weather` table. This spec covers the two additional phases agreed upon:

- **Phase 1b**: extend `fetch.py` to also collect daily mean temperature (`temp_mean`)
- **Phase 2**: compute Growing Degree Days (GDD) per day and store them in a new table
- **Phase 3**: React + Vite + TypeScript frontend with a Flask API, showing a frost-risk calendar for March–May

---

## Phase 1b: Add `temp_mean` to Data Collection

`daily_weather` currently lacks mean temperature. It must be added before Phase 2 can run.

### Changes to `fetch.py`

- Add `temperature_2m_mean` to the `daily` parameter list in `fetch_year()`
- Add `temp_mean REAL` column to `CREATE_TABLE_SQL`
- Add `temp_mean` to `INSERT_SQL` and the tuple built in `daily_rows()`

### Database migration

At startup, `fetch.py` attempts:
```sql
ALTER TABLE daily_weather ADD COLUMN temp_mean REAL;
```
If the column already exists, the `OperationalError` is silently caught. Re-running `fetch.py` then populates `temp_mean` for all rows via `INSERT OR REPLACE`.

---

## Phase 2: Data Analysis (`analyze.py`)

A standalone Python script with no new dependencies.

### Logic

For each year in the database:
1. Query `daily_weather` for all rows from `YYYY-01-01` onwards, ordered by date.
2. For each day, compute `gdd_daily = max(0, temp_mean - 10)` and maintain a running `gdd_accumulated` total.
3. Insert each row into `daily_gdd`.

### `daily_gdd` table schema

| column          | type    | notes                                                      |
|-----------------|---------|------------------------------------------------------------|
| date            | TEXT    | ISO `YYYY-MM-DD`, primary key                              |
| year            | INTEGER | extracted from date, for easy filtering                    |
| gdd_daily       | REAL    | degrees above 10°C for this day (`max(0, temp_mean - 10)`) |
| gdd_accumulated | REAL    | running total from Jan 1 of that year                      |

### CLI

```
python analyze.py
```

No arguments. Reads from and writes to `frost_data.db` in the current directory. Uses `INSERT OR REPLACE` — safe to re-run. Prints one line per year: `2001: GDD calculated for 365 days.`

### Querying the milestone

The GDD-40 milestone is not stored separately — it is derived on demand:
```sql
SELECT year, MIN(date) AS milestone_date
FROM daily_gdd
WHERE gdd_accumulated >= 40
GROUP BY year
ORDER BY year;
```

---

## Phase 3: Data Visualization (React + Vite + TypeScript)

### Architecture

A local single-page app served by the Vite dev server. The frontend reads from `frost_data.db` via a small Flask API server running on `localhost:5000`.

### API server (`api.py`)

Single-file Flask app. CORS enabled for the Vite dev server. No authentication.

**Endpoints:**

- `GET /weather?year_from=YYYY&year_to=YYYY`  
  Returns `daily_weather` rows for March–May (months 3–5) in the given year range.

- `GET /gdd-milestone?year_from=YYYY&year_to=YYYY`  
  Returns one row per year — `{ year, milestone_date }` — being the first date when `gdd_accumulated >= 40`, queried from `daily_gdd`.

Both return JSON arrays.

### Frontend structure

```
frontend/
├── index.html
├── package.json          # vite, react, typescript
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx
    ├── App.tsx           # year range picker, fetches data, renders CalendarView
    ├── CalendarView.tsx  # March–May grid with highlights, one section per year
    └── api.ts            # typed fetch helpers for the two endpoints
```

### UI behaviour

- Two number inputs at the top: **From year** / **To year**
- On change, fetches both endpoints and re-renders
- Calendar grid: one section per year, three columns (March / April / May), each day as a small tile
- Highlight colours:

| Colour     | Condition                                    |
|------------|----------------------------------------------|
| Light blue | `temp_min < 0°C`                             |
| Dark blue  | `temp_min < -1.5°C`                          |
| Red        | First day GDD accumulation ≥ 40 (from `/gdd-milestone`) |

- Hovering a tile shows a tooltip with date, min, max, and mean temperature

### Dependencies added

`requirements.txt`: `flask`, `flask-cors`  
`frontend/package.json`: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, TypeScript types

---

## Full file structure

```
frost-analysis/
├── fetch.py
├── analyze.py
├── api.py
├── requirements.txt
├── frost_data.db         # gitignored
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── CalendarView.tsx
│       └── api.ts
└── docs/
    └── superpowers/
        └── specs/
            ├── 2026-10-25-frost-analysis-design.md   # Phase 1 spec
            └── 2026-10-25-frost-analysis-phase2-3-design.md  # this file
```
