import { Day, DwdBudbreak } from "./api";

interface Props {
  day: Day | null;
  dwd: DwdBudbreak | null;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmt(value: number | null, unit: string, digits = 1): string {
  return value === null ? "n/a" : `${value.toFixed(digits)} ${unit}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ color: "#666", paddingRight: 12, paddingBottom: 6, whiteSpace: "nowrap" }}>{label}</td>
      <td style={{ fontWeight: 500, paddingBottom: 6 }}>{value}</td>
    </tr>
  );
}

function Heading({ children }: { children: string }) {
  return (
    <tr>
      <td colSpan={2} style={{ fontWeight: "bold", paddingTop: 8, paddingBottom: 6 }}>{children}</td>
    </tr>
  );
}

export default function DayDetail({ day, dwd }: Props) {
  if (!day) {
    return (
      <div style={{ color: "#999", fontSize: 13, paddingTop: 8 }}>
        Click a day to see details
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", fontSize: 13, minWidth: 220 }}>
      <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>{day.date}</h3>
      <table style={{ borderCollapse: "collapse" }}>
        <tbody>
          <Heading>Day (00:00–24:00)</Heading>
          <Row label="Max temperature" value={fmt(day.tmax, "°C")} />
          <Row label="Min temperature" value={fmt(day.tmin, "°C")} />
          <Row label="GDD (day)" value={fmt(day.gdd, "", 2)} />
          <Row label="GDD (accumulated)" value={fmt(day.gdd_accumulated, "", 2)} />
          <Row label="Mean humidity" value={fmt(day.humidity_mean, "%", 0)} />
          <Row label="Max wind speed" value={fmt(day.wind_max, "km/h")} />
          <Row label="Sunshine" value={fmt(day.sunshine_hours, "h")} />
          <Row label="Mean cloud cover" value={fmt(day.cloud_mean, "%", 0)} />
          <Heading>Night (20:00 previous day – 08:00)</Heading>
          <Row label="Night minimum" value={fmt(day.night_min, "°C")} />
          <Row
            label="Night minimum hour"
            value={day.night_min_hour === null ? "n/a" : `${pad(day.night_min_hour)}:00`}
          />
          <Row label="Mean wind speed" value={fmt(day.night_wind_mean, "km/h")} />
          <Row label="Mean cloud cover" value={fmt(day.night_cloud_mean, "%", 0)} />
          {day.frost_type && <Row label="Frost type" value={day.frost_type} />}
          {dwd && (
            <>
              <Heading>DWD budbreak</Heading>
              <Row label="Station" value={dwd.station} />
              <Row label="Distance" value={`${dwd.distance_km.toFixed(1)} km`} />
              <Row label="Height" value={`${dwd.height_m} m`} />
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
