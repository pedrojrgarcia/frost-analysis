import { useState, useEffect } from "react";
import { fetchWeather, fetchGddMilestones, WeatherDay, GddMilestone } from "./api";
import CalendarView from "./CalendarView";

const CURRENT_YEAR = new Date().getFullYear();

export default function App() {
  const [yearFrom, setYearFrom] = useState(CURRENT_YEAR - 5);
  const [yearTo, setYearTo] = useState(CURRENT_YEAR);
  const [weather, setWeather] = useState<WeatherDay[]>([]);
  const [milestones, setMilestones] = useState<GddMilestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchWeather(yearFrom, yearTo),
      fetchGddMilestones(yearFrom, yearTo),
    ])
      .then(([w, m]) => {
        setWeather(w);
        setMilestones(m);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [yearFrom, yearTo]);

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
        <CalendarView
          yearFrom={yearFrom}
          yearTo={yearTo}
          weather={weather}
          milestones={milestones}
        />
      )}
    </div>
  );
}
