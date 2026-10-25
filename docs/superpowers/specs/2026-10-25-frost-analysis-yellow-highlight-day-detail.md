# Frost Analysis — Yellow Highlight & Day Detail Panel

## Context

Two new UI features added to the existing React frontend:

1. **Yellow highlight**: days where `temp_mean > 10°C` are highlighted yellow in the calendar
2. **Day detail panel**: clicking any calendar tile shows all available data for that day in a side panel

No changes to the Python data pipeline or database schema.

---

## Feature 1: Yellow highlight

### Condition

`temp_mean > 10°C` — indicates a day that contributes positively to GDD accumulation.

### Priority order (highest wins)

| Priority | Colour     | Condition                        |
|----------|------------|----------------------------------|
| 1        | Red        | GDD milestone day (GDD ≥ 40)    |
| 2        | Dark blue  | `temp_min < -1.5°C`             |
| 3        | Light blue | `temp_min < 0°C`                |
| 4        | Yellow     | `temp_mean > 10°C`              |
| 5        | None       | no condition met                |

### Files changed

- `frontend/src/CalendarView.tsx` — `dayColor()` receives `tempMean` as a new parameter; yellow branch added; legend updated

---

## Feature 2: Day detail side panel

### Behaviour

- Clicking a tile selects it (highlighted with a darker border); clicking again deselects
- A sticky panel to the right of the calendar shows all data for the selected day
- When nothing is selected, the panel shows "Click a day to see details"

### Data shown

| Field              | Source          |
|--------------------|-----------------|
| Date               | `daily_weather` |
| Min temperature    | `daily_weather` |
| Max temperature    | `daily_weather` |
| Mean temperature   | `daily_weather` |
| Humidity           | `daily_weather` |
| Wind speed         | `daily_weather` |
| Sunshine duration  | `daily_weather` (converted from seconds to hours) |
| Cloud cover        | `daily_weather` |
| GDD (day)          | `daily_gdd`     |
| GDD (accumulated)  | `daily_gdd`     |

### New API endpoint

`GET /gdd?year_from=YYYY&year_to=YYYY` — returns `daily_gdd` rows for March–May in the given range. Needed to supply GDD fields to the side panel.

### Files changed / created

| File | Change |
|------|--------|
| `api.py` | Added `GET /gdd` endpoint |
| `frontend/src/api.ts` | Added `GddDay` type and `fetchGdd()` function |
| `frontend/src/App.tsx` | Added `selectedDay` state, fetches `/gdd`, passes props to `CalendarView` and `DayDetail` |
| `frontend/src/CalendarView.tsx` | Added `selectedDate` + `onDaySelect` props; click handler on tiles |
| `frontend/src/DayDetail.tsx` | New component — renders selected day data |
