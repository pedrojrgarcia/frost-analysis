import { Source, SOURCE_LABELS, WeatherDay, GddDay, GddMilestone } from "./api";

export interface SourceData {
  weather: WeatherDay[];
  gddDays: GddDay[];
  milestones: GddMilestone[];
}

export interface Selection {
  source: Source;
  day: WeatherDay;
}

interface Props {
  yearFrom: number;
  yearTo: number;
  data: Record<Source, SourceData>;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
}

const SOURCES: Source[] = ["open_meteo", "gee"];

const MONTHS = [
  { month: 3, name: "March", days: 31 },
  { month: 4, name: "April", days: 30 },
  { month: 5, name: "May", days: 31 },
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dayColor(
  date: string,
  tempMin: number,
  tempMean: number,
  milestoneByYear: Map<number, string>
): string {
  const year = parseInt(date.slice(0, 4));
  const milestone = milestoneByYear.get(year);
  if (milestone === date) return "#c0392b";  // red — GDD milestone
  if (tempMin < -1.5) return "#1a5276";      // dark blue
  if (tempMin < 0) return "#85c1e9";         // light blue
  if (tempMean > 10) return "#f1c40f";       // yellow — mean > 10°C
  return "transparent";
}

interface MonthGridProps {
  year: number;
  source: Source;
  weatherByDate: Map<string, WeatherDay>;
  milestoneByYear: Map<number, string>;
  selectedDate: string | null;
  onSelect: (day: WeatherDay | null) => void;
}

function YearGrid({
  year,
  weatherByDate,
  milestoneByYear,
  selectedDate,
  onSelect,
}: MonthGridProps) {
  return (
    <div style={{ display: "flex", gap: 16 }}>
      {MONTHS.map(({ month, name, days }) => (
        <div key={month}>
          <div style={{ fontWeight: "bold", marginBottom: 4 }}>{name}</div>
          <div style={{ display: "flex", flexWrap: "wrap", width: 7 * 20 }}>
            {Array.from({ length: days }, (_, i) => {
              const day = i + 1;
              const date = `${year}-${pad(month)}-${pad(day)}`;
              const entry = weatherByDate.get(date);
              const bg = entry
                ? dayColor(date, entry.temp_min, entry.temp_mean, milestoneByYear)
                : "#eee";
              const isSelected = selectedDate === date;
              const title = entry
                ? `${date}\nMin: ${entry.temp_min}°C\nMax: ${entry.temp_max}°C\nMean: ${entry.temp_mean}°C`
                : date;
              return (
                <div
                  key={day}
                  title={title}
                  onClick={() => entry && onSelect(isSelected ? null : entry)}
                  style={{
                    width: 18,
                    height: 18,
                    margin: 1,
                    background: bg,
                    border: isSelected ? "2px solid #333" : "1px solid #ccc",
                    cursor: entry ? "pointer" : "default",
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    color: bg === "transparent" || bg === "#eee" ? "#999" : bg === "#f1c40f" ? "#333" : "#fff",
                    boxSizing: "border-box",
                  }}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CalendarView({
  yearFrom,
  yearTo,
  data,
  selection,
  onSelect,
}: Props) {
  const lookups = Object.fromEntries(
    SOURCES.map((source) => [
      source,
      {
        weatherByDate: new Map(data[source].weather.map((d) => [d.date, d])),
        milestoneByYear: new Map(data[source].milestones.map((m) => [m.year, m.milestone_date])),
      },
    ])
  ) as Record<Source, { weatherByDate: Map<string, WeatherDay>; milestoneByYear: Map<number, string> }>;
  const years = Array.from(
    { length: yearTo - yearFrom + 1 },
    (_, i) => yearFrom + i
  );

  return (
    <div style={{ fontFamily: "monospace", fontSize: 12 }}>
      {years.map((year) => (
        <div key={year} style={{ marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 8px" }}>{year}</h3>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            {SOURCES.map((source) => (
              <div key={source}>
                <div style={{ fontFamily: "sans-serif", fontSize: 13, marginBottom: 6, color: "#555" }}>
                  {SOURCE_LABELS[source]}
                </div>
                <YearGrid
                  year={year}
                  source={source}
                  weatherByDate={lookups[source].weatherByDate}
                  milestoneByYear={lookups[source].milestoneByYear}
                  selectedDate={selection?.source === source ? selection.day.date : null}
                  onSelect={(day) => onSelect(day ? { source, day } : null)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ marginTop: 16, display: "flex", gap: 16, fontSize: 11 }}>
        <span><span style={{ background: "#85c1e9", padding: "2px 8px", marginRight: 4 }} />temp_min &lt; 0°C</span>
        <span><span style={{ background: "#1a5276", padding: "2px 8px", marginRight: 4 }} />temp_min &lt; -1.5°C</span>
        <span><span style={{ background: "#c0392b", padding: "2px 8px", marginRight: 4 }} />GDD ≥ 40 milestone</span>
        <span><span style={{ background: "#f1c40f", padding: "2px 8px", marginRight: 4 }} />temp_mean &gt; 10°C</span>
      </div>
    </div>
  );
}
