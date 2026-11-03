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
import FrostSummaryTable from "./FrostSummaryTable";
import PlotBox from "./PlotBox";

const CURRENT_YEAR = new Date().getFullYear();

export default function App() {
  const [yearFrom, setYearFrom] = useState(CURRENT_YEAR - 5);
  const [yearTo, setYearTo] = useState(CURRENT_YEAR);
  const [days, setDays] = useState<Day[]>([]);
  const [milestones, setMilestones] = useState<GddMilestone[]>([]);
  const [dwd, setDwd] = useState<DwdBudbreak[]>([]);
  const [summary, setSummary] = useState<FrostSummary[]>([]);
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
      fetchFrostSummary(yearFrom, yearTo),
      fetchTerrain(),
    ])
      .then(([d, m, w, s, t]) => {
        setDays(d);
        setMilestones(m);
        setDwd(w);
        setSummary(s);
        setTerrain(t);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [yearFrom, yearTo]);

  // nearest station per year
  const nearestByYear = new Map<number, DwdBudbreak>();
  for (const r of dwd) {
    const best = nearestByYear.get(r.year);
    if (!best || r.distance_km < best.distance_km) nearestByYear.set(r.year, r);
  }
  const dwdByDate = new Map([...nearestByYear.values()].map((r) => [r.budbreak_date, r]));

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
        <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
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
            }}
          >
            <PlotBox terrain={terrain} />
            <FrostChart summary={summary} />
            <FrostSummaryTable summary={summary} />
            <DayDetail day={selectedDay} dwd={selectedDay ? (dwdByDate.get(selectedDay.date) ?? null) : null} />
          </div>
        </div>
      )}
    </div>
  );
}
