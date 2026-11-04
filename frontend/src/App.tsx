import { useState, useEffect } from "react";
import {
  fetchDays,
  fetchGddMilestones,
  fetchDwdBudbreak,
  fetchFrostSummary,
  fetchTerrain,
  Day,
  DwdBudbreak,
  FrostSummary,
  GddMilestone,
  Terrain,
} from "./api";
import CalendarView from "./CalendarView";
import DayDetail from "./DayDetail";
import FrostChart from "./FrostChart";
import FrostHistoryChart from "./FrostHistoryChart";
import { CHART_MAX_WIDTH } from "./chartLayout";
import FrostSummaryTable from "./FrostSummaryTable";
import PlotBox from "./PlotBox";

const CURRENT_YEAR = new Date().getFullYear();
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
    ])
      .then(([d, m, w, s, t]) => {
        setDays(d);
        setMilestones(m);
        setDwd(w);
        setSummaryWithHistory(s);
        setTerrain(t);
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
            <FrostChart summary={summary} />
            <FrostHistoryChart summary={summary} history={summaryWithHistory} />
            <FrostSummaryTable summary={summary} />
            <DayDetail day={selectedDay} dwd={selectedDay ? (dwdByDate.get(selectedDay.date) ?? null) : null} />
          </div>
        </div>
      )}
    </div>
  );
}
