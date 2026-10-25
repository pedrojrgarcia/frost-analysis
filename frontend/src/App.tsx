import { useState, useEffect } from "react";
import { fetchWeather, fetchGdd, fetchGddMilestones, WeatherDay, GddDay, GddMilestone } from "./api";
import CalendarView from "./CalendarView";
import DayDetail from "./DayDetail";

const CURRENT_YEAR = new Date().getFullYear();

export default function App() {
  const [yearFrom, setYearFrom] = useState(CURRENT_YEAR - 5);
  const [yearTo, setYearTo] = useState(CURRENT_YEAR);
  const [weather, setWeather] = useState<WeatherDay[]>([]);
  const [gddDays, setGddDays] = useState<GddDay[]>([]);
  const [milestones, setMilestones] = useState<GddMilestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<WeatherDay | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSelectedDay(null);
    Promise.all([
      fetchWeather(yearFrom, yearTo),
      fetchGdd(yearFrom, yearTo),
      fetchGddMilestones(yearFrom, yearTo),
    ])
      .then(([w, g, m]) => {
        setWeather(w);
        setGddDays(g);
        setMilestones(m);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [yearFrom, yearTo]);

  const gddByDate = new Map(gddDays.map((g) => [g.date, g]));
  const selectedGdd = selectedDay ? (gddByDate.get(selectedDay.date) ?? null) : null;

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
            weather={weather}
            milestones={milestones}
            selectedDate={selectedDay?.date ?? null}
            onDaySelect={setSelectedDay}
          />
          <div style={{ position: "sticky", top: 24 }}>
            <DayDetail day={selectedDay} gdd={selectedGdd} />
          </div>
        </div>
      )}
    </div>
  );
}
