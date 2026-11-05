import { useState, useEffect } from "react";
import {
  fetchDays,
  fetchGddMilestones,
  fetchDwdBudbreak,
  fetchFrostSummary,
  fetchTerrain,
  fetchStationDays,
  Day,
  DwdBudbreak,
  FrostSummary,
  GddMilestone,
  StationDay,
  Terrain,
} from "./api";
import CalendarView from "./CalendarView";
import DayDetail from "./DayDetail";
import FrostChart, { StationCount } from "./FrostChart";
import FrostHistoryChart from "./FrostHistoryChart";
import { CHART_MAX_WIDTH } from "./chartLayout";
import FrostSummaryTable from "./FrostSummaryTable";
import PlotBox from "./PlotBox";

const CURRENT_YEAR = new Date().getFullYear();
// station budbreak: 60 GDD instead of 40. The station stands on a sunny steep slope, its day maximum is
// higher than ERA5, so GDD adds up faster. Compared with the DWD valley dates 2009-2025 (14 years):
// 40 GDD = about 11 days too early (mean error 18 days), 60 GDD = about 2 days early (13.9 days).
const STATION_GDD_MILESTONE = 60;
const AVERAGE_LOOKBACK = 9; // extra years before the selection for the 10-year average
// optional start range from the address, e.g. ?from=1976&to=2025
const params = new URLSearchParams(window.location.search);
const START_FROM = Number(params.get("from")) || CURRENT_YEAR - 5;
const START_TO = Number(params.get("to")) || CURRENT_YEAR;

export default function App() {
  const [yearFrom, setYearFrom] = useState(START_FROM);
  const [yearTo, setYearTo] = useState(START_TO);
  const [days, setDays] = useState<Day[]>([]);
  const [milestones, setMilestones] = useState<GddMilestone[]>([]);
  const [dwd, setDwd] = useState<DwdBudbreak[]>([]);
  // frost summary from AVERAGE_LOOKBACK years before the selection, so the 10-year average covers the whole range
  const [summaryWithHistory, setSummaryWithHistory] = useState<FrostSummary[]>([]);
  const [terrain, setTerrain] = useState<Terrain | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Day | null>(null);
  const [stationRows, setStationRows] = useState<StationDay[]>([]);
  // which station temperature counts for frost: 2 m (as ERA5) or 20 cm (near the buds)
  const [stationHeight, setStationHeight] = useState<"2m" | "20cm">("2m");

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSelectedDay(null);
    Promise.all([
      fetchDays(yearFrom, yearTo),
      fetchGddMilestones(yearFrom, yearTo),
      fetchDwdBudbreak(yearFrom, yearTo),
      fetchFrostSummary(yearFrom - AVERAGE_LOOKBACK, yearTo),
      fetchTerrain(),
      fetchStationDays(yearFrom, yearTo),
    ])
      .then(([d, m, w, s, t, n]) => {
        setDays(d);
        setMilestones(m);
        setDwd(w);
        setSummaryWithHistory(s);
        setTerrain(t);
        setStationRows(n);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [yearFrom, yearTo]);

  const summary = summaryWithHistory.filter((s) => s.year >= yearFrom);

  // the DWD station the frost summary uses for each year (valley stations only, see api.py)
  const stationByYear = new Map(
    summary
      .filter((s) => s.budbreak_source?.startsWith("DWD "))
      .map((s) => [s.year, s.budbreak_source!.slice(4)])
  );
  const usedDwd = dwd.filter((r) => stationByYear.get(r.year) === r.station);
  const dwdByDate = new Map(usedDwd.map((r) => [r.budbreak_date, r]));

  // station calendar: the station's own Tmin/Tmax/GDD and night minimum (2 m or 20 cm)
  const dayByDate = new Map(days.map((d) => [d.date, d]));
  const stationByDate = new Map(stationRows.map((r) => [r.date, r]));
  const stationDays: Day[] = stationRows.flatMap((r) => {
    const nightMin = stationHeight === "2m" ? r.night_min_2m : r.night_min_20cm;
    if (r.tmin === null && nightMin === null) return []; // no station data: grey tile
    return [{
      date: r.date,
      tmax: r.tmax ?? NaN,
      tmin: r.tmin ?? NaN,
      gdd: r.gdd ?? 0,
      gdd_accumulated: r.gdd_accumulated,
      humidity_mean: null,
      wind_max: null,
      sunshine_hours: null,
      cloud_mean: null,
      night_min: nightMin,
      night_min_hour: null,
      night_wind_mean: r.night_wind_mean,
      night_cloud_mean: null,
      frost_type: null,
    }];
  });
  // station budbreak (model): first day with accumulated GDD >= threshold (December belongs to the year before)
  const stationMilestonesAt = (threshold: number): GddMilestone[] => {
    const found = new Map<number, string>();
    for (const d of stationDays) {
      const year = Number(d.date.slice(0, 4));
      if (d.date.slice(5, 7) !== "12" && d.gdd_accumulated >= threshold && !found.has(year)) found.set(year, d.date);
    }
    return [...found].map(([year, milestone_date]) => ({ year, milestone_date }));
  };
  const stationMilestones40 = stationMilestonesAt(40);
  const stationMilestones = stationMilestonesAt(STATION_GDD_MILESTONE);
  // station frost nights per year for the bar chart: same budbreak date and end as ERA5, only the night minimum differs.
  // null when the station has fewer than 80 % of the nights between budbreak and the end.
  const stationCounts = new Map<number, StationCount | null>();
  for (const s of summary) {
    if (!s.budbreak_date) continue;
    const end = `${s.year}-05-31`;
    const window = stationRows.filter((r) => r.date > s.budbreak_date! && r.date <= end);
    const nights = window
      .map((r) => (stationHeight === "2m" ? r.night_min_2m : r.night_min_20cm))
      .filter((v): v is number => v !== null);
    const expected = Math.round((Date.parse(end) - Date.parse(s.budbreak_date)) / 86400000);
    stationCounts.set(
      s.year,
      expected > 0 && nights.length >= expected * 0.8
        ? { frost: nights.filter((v) => v <= 0).length, severe: nights.filter((v) => v <= -1.5).length }
        : null
    );
  }
  const stationFirstYear = stationDays.length ? stationDays[0].date.slice(0, 4) : null;

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ marginBottom: 16 }}>Frost Risk Analysis</h1>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 24 }}>
        <label>
          From year:{" "}
          <input
            type="number"
            value={yearFrom}
            min={1900}
            max={yearTo}
            onChange={(e) => setYearFrom(Number(e.target.value))}
            style={{ width: 70 }}
          />
        </label>
        <label>
          To year:{" "}
          <input
            type="number"
            value={yearTo}
            min={yearFrom}
            max={CURRENT_YEAR}
            onChange={(e) => setYearTo(Number(e.target.value))}
            style={{ width: 70 }}
          />
        </label>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {!loading && !error && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 40, alignItems: "flex-start" }}>
          <CalendarView
            yearFrom={yearFrom}
            yearTo={yearTo}
            days={days}
            title="ERA5-Land (Open-Meteo), 9 km grid, 2 m"
            milestones={milestones}
            dwdByDate={dwdByDate}
            selectedDate={selectedDay?.date ?? null}
            onSelect={setSelectedDay}
          />
          <div
            style={{
              position: "sticky",
              top: 24,
              maxHeight: "calc(100vh - 48px)",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 24,
              // width from the window, not from the content: the same for every year selection;
              // up to the chart width, and below the calendar when the window is narrow
              flex: "1 1 340px",
              minWidth: 0,
              maxWidth: CHART_MAX_WIDTH,
            }}
          >
            <PlotBox terrain={terrain} />
            <FrostChart
              summary={summary}
              station={stationCounts}
              stationLabel={`station Traben-Trarbach ${stationHeight === "2m" ? "2 m" : "20 cm"}`}
            />
            <FrostHistoryChart summary={summary} history={summaryWithHistory} />
            <FrostSummaryTable summary={summary} />
            <DayDetail
              day={selectedDay}
              dwd={selectedDay ? (dwdByDate.get(selectedDay.date) ?? null) : null}
              station={selectedDay ? (stationByDate.get(selectedDay.date) ?? null) : null}
            />
          </div>
          <CalendarView
            yearFrom={yearFrom}
            yearTo={yearTo}
            days={stationDays}
            milestones={stationMilestones40}
            budbreakLabel="Budbreak, station GDD ≥ 40 (as ERA5)"
            secondMilestones={stationMilestones}
            secondLabel={`Budbreak, station GDD ≥ ${STATION_GDD_MILESTONE} (fits DWD better)`}
            dwdByDate={dwdByDate}
            selectedDate={selectedDay?.date ?? null}
            onSelect={(d) => setSelectedDay(d ? (dayByDate.get(d.date) ?? null) : null)}
            title="Station Traben-Trarbach (Agrarmeteorologie RLP, 1 km, 132 m, steep slope)"
            nightLabel={`Station night min ${stationHeight === "2m" ? "2 m" : "20 cm"}`}
            headerExtra={
              <span style={{ color: "#555" }}>
                Frost from:{" "}
                <label>
                  <input type="radio" checked={stationHeight === "2m"} onChange={() => setStationHeight("2m")} /> 2 m
                </label>{" "}
                <label>
                  <input type="radio" checked={stationHeight === "20cm"} onChange={() => setStationHeight("20cm")} /> 20 cm
                </label>
                <span style={{ color: "#888" }}>
                  {" "}· station data {stationFirstYear ? `from ${stationFirstYear}` : "none for these years"}; GDD from the station. Red = GDD 40 (as ERA5), lilac = GDD {STATION_GDD_MILESTONE}: sunny slope, warmer days; with 40 budbreak came about 11 days before the DWD dates, with {STATION_GDD_MILESTONE} about 2 days (2009–2025)
                </span>
              </span>
            }
          />
        </div>
      )}
    </div>
  );
}
