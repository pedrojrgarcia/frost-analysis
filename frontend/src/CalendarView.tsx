import { Day, DwdBudbreak, GddMilestone } from "./api";

interface Props {
  yearFrom: number;
  yearTo: number;
  days: Day[];
  milestones: GddMilestone[];
  dwdByDate: Map<string, DwdBudbreak>;
  selectedDate: string | null;
  onSelect: (day: Day | null) => void;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// December of the previous year through October: winter, spring and autumn frost
function monthsOf(year: number) {
  const list = [{ year: year - 1, month: 12 }];
  for (let month = 1; month <= 10; month++) list.push({ year, month });
  return list.map(({ year: y, month }) => ({
    year: y,
    month,
    name: `${MONTH_NAMES[month - 1]} ${y}`,
    days: new Date(y, month, 0).getDate(),
  }));
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dayColor(
  date: string,
  nightMin: number | null,
  gdd: number,
  milestoneByYear: Map<number, string>,
  isDwd: boolean
): string {
  const year = parseInt(date.slice(0, 4));
  const milestone = milestoneByYear.get(year);
  if (milestone === date) return "#c0392b";  // red — GDD milestone (green ring if also DWD)
  if (isDwd) return "#27ae60";               // green — DWD budbreak, nearest station
  if (nightMin !== null && nightMin <= -1.5) return "#1a5276";  // dark blue
  if (nightMin !== null && nightMin <= 0) return "#85c1e9";     // light blue
  if (gdd > 0) return "#f1c40f";             // yellow — (Tmax+Tmin)/2 > 7.5°C
  return "transparent";
}

interface YearGridProps {
  year: number;
  dayByDate: Map<string, Day>;
  milestoneByYear: Map<number, string>;
  dwdByDate: Map<string, DwdBudbreak>;
  selectedDate: string | null;
  onSelect: (day: Day | null) => void;
}

function YearGrid({
  year,
  dayByDate,
  milestoneByYear,
  dwdByDate,
  selectedDate,
  onSelect,
}: YearGridProps) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, maxWidth: 4 * (7 * 20 + 16) }}>
      {monthsOf(year).map(({ year: monthYear, month, name, days }) => (
        <div key={month}>
          <div style={{ fontWeight: "bold", marginBottom: 4 }}>{name}</div>
          <div style={{ display: "flex", flexWrap: "wrap", width: 7 * 20 }}>
            {Array.from({ length: days }, (_, i) => {
              const day = i + 1;
              const date = `${monthYear}-${pad(month)}-${pad(day)}`;
              const entry = dayByDate.get(date);
              const isDwd = dwdByDate.has(date);
              const isBoth = isDwd && milestoneByYear.get(monthYear) === date;
              const bg = entry
                ? dayColor(date, entry.night_min, entry.gdd, milestoneByYear, isDwd)
                : "#eee";
              const isSelected = selectedDate === date;
              const title = entry
                ? `${date}\nNight min: ${entry.night_min ?? "n/a"}°C\nTmin: ${entry.tmin}°C\nTmax: ${entry.tmax}°C`
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
                    boxShadow: isBoth ? "inset 0 0 0 2px #27ae60" : undefined,
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
  days,
  milestones,
  dwdByDate,
  selectedDate,
  onSelect,
}: Props) {
  const dayByDate = new Map(days.map((d) => [d.date, d]));
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
          <YearGrid
            year={year}
            dayByDate={dayByDate}
            milestoneByYear={milestoneByYear}
            dwdByDate={dwdByDate}
            selectedDate={selectedDate}
            onSelect={onSelect}
          />
        </div>
      ))}
      <div style={{ marginTop: 16, display: "flex", gap: 16, fontSize: 11 }}>
        <span><span style={{ background: "#85c1e9", padding: "2px 8px", marginRight: 4 }} />night_min ≤ 0°C</span>
        <span><span style={{ background: "#1a5276", padding: "2px 8px", marginRight: 4 }} />night_min ≤ −1.5°C</span>
        <span><span style={{ background: "#c0392b", padding: "2px 8px", marginRight: 4 }} />GDD ≥ 40 milestone</span>
        <span><span style={{ background: "#27ae60", padding: "2px 8px", marginRight: 4 }} />DWD budbreak (nearest station; green ring on red = same day as GDD)</span>
        <span><span style={{ background: "#f1c40f", padding: "2px 8px", marginRight: 4 }} />(Tmax+Tmin)/2 &gt; 7.5°C</span>
      </div>
    </div>
  );
}
