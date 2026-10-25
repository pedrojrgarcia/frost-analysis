import { useState, useEffect } from "react";
import {
  fetchWeather,
  fetchGdd,
  fetchGddMilestones,
  Source,
  GddDay,
} from "./api";
import CalendarView, { SourceData, Selection } from "./CalendarView";
import DayDetail from "./DayDetail";

const CURRENT_YEAR = new Date().getFullYear();
const SOURCES: Source[] = ["open_meteo", "gee"];

const EMPTY: SourceData = { weather: [], gddDays: [], milestones: [] };

export default function App() {
  const [yearFrom, setYearFrom] = useState(CURRENT_YEAR - 5);
  const [yearTo, setYearTo] = useState(CURRENT_YEAR);
  const [data, setData] = useState<Record<Source, SourceData>>({
    open_meteo: EMPTY,
    gee: EMPTY,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSelection(null);
    Promise.all(
      SOURCES.map((source) =>
        Promise.all([
          fetchWeather(source, yearFrom, yearTo),
          fetchGdd(source, yearFrom, yearTo),
          fetchGddMilestones(source, yearFrom, yearTo),
        ]).then(([weather, gddDays, milestones]): [Source, SourceData] => [
          source,
          { weather, gddDays, milestones },
        ])
      )
    )
      .then((entries) =>
        setData(Object.fromEntries(entries) as Record<Source, SourceData>)
      )
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [yearFrom, yearTo]);

  const selectedGdd: GddDay | null = selection
    ? (data[selection.source].gddDays.find((g) => g.date === selection.day.date) ?? null)
    : null;

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
            data={data}
            selection={selection}
            onSelect={setSelection}
          />
          <div style={{ position: "sticky", top: 24 }}>
            <DayDetail
              source={selection?.source ?? null}
              day={selection?.day ?? null}
              gdd={selectedGdd}
            />
          </div>
        </div>
      )}
    </div>
  );
}
