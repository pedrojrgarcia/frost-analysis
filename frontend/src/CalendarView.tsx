import { WeatherDay, GddMilestone } from "./api";

interface Props {
  yearFrom: number;
  yearTo: number;
  weather: WeatherDay[];
  milestones: GddMilestone[];
}

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
  milestoneByYear: Map<number, string>
): string {
  const year = parseInt(date.slice(0, 4));
  const milestone = milestoneByYear.get(year);
  if (milestone === date) return "#c0392b"; // red — GDD milestone
  if (tempMin < -1.5) return "#1a5276"; // dark blue
  if (tempMin < 0) return "#85c1e9"; // light blue
  return "transparent";
}

export default function CalendarView({
  yearFrom,
  yearTo,
  weather,
  milestones,
}: Props) {
  const weatherByDate = new Map(weather.map((d) => [d.date, d]));
  const milestoneByYear = new Map(milestones.map((m) => [m.year, m.milestone_date]));
  const years = Array.from(
    { length: yearTo - yearFrom + 1 },
    (_, i) => yearFrom + i
  );

  return (
    <div style={{ fontFamily: "monospace", fontSize: 12 }}>
      {years.map((year) => (
        <div key={year} style={{ marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 8px" }}>{year}</h3>
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
                      ? dayColor(date, entry.temp_min, milestoneByYear)
                      : "#eee";
                    const title = entry
                      ? `${date}\nMin: ${entry.temp_min}°C\nMax: ${entry.temp_max}°C\nMean: ${entry.temp_mean}°C`
                      : date;
                    return (
                      <div
                        key={day}
                        title={title}
                        style={{
                          width: 18,
                          height: 18,
                          margin: 1,
                          background: bg,
                          border: "1px solid #ccc",
                          cursor: "default",
                          borderRadius: 2,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 9,
                          color: bg === "transparent" || bg === "#eee" ? "#999" : "#fff",
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
        </div>
      ))}
      <div style={{ marginTop: 16, display: "flex", gap: 16, fontSize: 11 }}>
        <span><span style={{ background: "#85c1e9", padding: "2px 8px", marginRight: 4 }} />temp_min &lt; 0°C</span>
        <span><span style={{ background: "#1a5276", padding: "2px 8px", marginRight: 4 }} />temp_min &lt; -1.5°C</span>
        <span><span style={{ background: "#c0392b", padding: "2px 8px", marginRight: 4 }} />GDD ≥ 40 milestone</span>
      </div>
    </div>
  );
}
