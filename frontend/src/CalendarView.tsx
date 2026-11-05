import type { ReactNode } from "react";
import { Day, DwdBudbreak, GddMilestone } from "./api";

interface Props {
  yearFrom: number;
  yearTo: number;
  days: Day[];
  milestones: GddMilestone[];
  dwdByDate: Map<string, DwdBudbreak>;
  selectedDate: string | null;
  onSelect: (day: Day | null) => void;
  title?: string;
  // extra content in the sticky header, e.g. a switch (station calendar)
  headerExtra?: ReactNode;
  // what night_min means in the tooltip
  nightLabel?: string;
  // legend text for the red budbreak tile
  budbreakLabel?: string;
  // optional second budbreak (lilac), e.g. the station at another GDD threshold
  secondMilestones?: GddMilestone[];
  secondLabel?: string;
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

// four months side by side: 7 tiles of 20 px plus a 16 px gap each
const CALENDAR_WIDTH = 4 * (7 * 20 + 16);

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dayColor(
  date: string,
  nightMin: number | null,
  gdd: number,
  milestoneByYear: Map<number, string>,
  isDwd: boolean,
  secondByYear: Map<number, string>
): string {
  const year = parseInt(date.slice(0, 4));
  const milestone = milestoneByYear.get(year);
  if (milestone === date) return "#c0392b";  // red — GDD milestone (green ring if also DWD)
  if (secondByYear.get(year) === date) return "#a569bd";  // lilac — second GDD milestone
  if (isDwd) return "#27ae60";               // green — DWD budbreak, nearest valley station
  if (nightMin !== null && nightMin <= -1.5) return "#1a5276";  // dark blue
  if (nightMin !== null && nightMin <= 0) return "#85c1e9";     // light blue
  if (gdd > 0) return "#f1c40f";             // yellow — (Tmax+Tmin)/2 > 7.5°C
  return "transparent";
}

interface YearGridProps {
  year: number;
  dayByDate: Map<string, Day>;
  milestoneByYear: Map<number, string>;
  secondByYear: Map<number, string>;
  dwdByDate: Map<string, DwdBudbreak>;
  selectedDate: string | null;
  onSelect: (day: Day | null) => void;
  nightLabel: string;
}

function YearGrid({
  year,
  dayByDate,
  milestoneByYear,
  secondByYear,
  dwdByDate,
  selectedDate,
  onSelect,
  nightLabel,
}: YearGridProps) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, maxWidth: CALENDAR_WIDTH }}>
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
                ? dayColor(date, entry.night_min, entry.gdd, milestoneByYear, isDwd, secondByYear)
                : "#eee";
              const isSelected = selectedDate === date;
              const title = entry
                ? `${date}\n${nightLabel}: ${entry.night_min ?? "n/a"}°C\nTmin: ${entry.tmin}°C\nTmax: ${entry.tmax}°C`
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
  title,
  headerExtra,
  nightLabel = "Night min",
  budbreakLabel = "Budbreak, model (GDD ≥ 40)",
  secondMilestones = [],
  secondLabel,
}: Props) {
  const dayByDate = new Map(days.map((d) => [d.date, d]));
  const milestoneByYear = new Map(milestones.map((m) => [m.year, m.milestone_date]));
  const secondByYear = new Map(secondMilestones.map((m) => [m.year, m.milestone_date]));
  const years = Array.from(
    { length: yearTo - yearFrom + 1 },
    (_, i) => yearFrom + i
  );

  return (
    <div style={{ fontFamily: "monospace", fontSize: 12, maxWidth: CALENDAR_WIDTH }}>
      {/* legend stays visible at the top while scrolling, wrapped to the calendar width */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          background: "Canvas",
          padding: "8px 0",
          marginBottom: 12,
          borderBottom: "1px solid #e4e4e4",
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 14px",
          fontFamily: "sans-serif",
          fontSize: 12,
        }}
      >
        {title && <div style={{ width: "100%", fontWeight: "bold", fontSize: 13 }}>{title}</div>}
        {headerExtra && <div style={{ width: "100%" }}>{headerExtra}</div>}
        <LegendItem color="#85c1e9" label="Frost night (≤ 0 °C)" />
        <LegendItem color="#1a5276" label="Severe frost (≤ −1.5 °C)" />
        <LegendItem color="#c0392b" label={budbreakLabel} />
        {secondLabel && <LegendItem color="#a569bd" label={secondLabel} />}
        <LegendItem color="#27ae60" label="Budbreak, DWD valley station" />
        <span style={{ color: "#888" }}>Green ring on red = same day</span>
        <LegendItem color="#f1c40f" label="GDD > 0 ((Tmax+Tmin)/2 > 7.5 °C)" />
      </div>
      {years.map((year) => (
        <div key={year} style={{ marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 8px" }}>{year}</h3>
          <YearGrid
            year={year}
            dayByDate={dayByDate}
            milestoneByYear={milestoneByYear}
            secondByYear={secondByYear}
            dwdByDate={dwdByDate}
            selectedDate={selectedDate}
            onSelect={onSelect}
            nightLabel={nightLabel}
          />
        </div>
      ))}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ whiteSpace: "nowrap" }}>
      <span
        style={{
          display: "inline-block",
          width: 12,
          height: 12,
          borderRadius: 2,
          background: color,
          verticalAlign: "-2px",
          marginRight: 5,
        }}
      />
      {label}
    </span>
  );
}
