import { Source, SOURCE_LABELS, WeatherDay, GddDay } from "./api";

interface Props {
  source: Source | null;
  day: WeatherDay | null;
  gdd: GddDay | null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ color: "#666", paddingRight: 12, paddingBottom: 6, whiteSpace: "nowrap" }}>{label}</td>
      <td style={{ fontWeight: 500, paddingBottom: 6 }}>{value}</td>
    </tr>
  );
}

function orNa(value: number | null, format: (v: number) => string): string {
  return value === null ? "n/a" : format(value);
}

export default function DayDetail({ source, day, gdd }: Props) {
  if (!day || !source) {
    return (
      <div style={{ color: "#999", fontSize: 13, paddingTop: 8 }}>
        Click a day to see details
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", fontSize: 13, minWidth: 200 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>{day.date}</h3>
      <div style={{ color: "#666", marginBottom: 12 }}>{SOURCE_LABELS[source]}</div>
      <table style={{ borderCollapse: "collapse" }}>
        <tbody>
          <Row label="Min temperature" value={`${day.temp_min} °C`} />
          <Row label="Max temperature" value={`${day.temp_max} °C`} />
          <Row label="Mean temperature" value={`${day.temp_mean} °C`} />
          <Row label="Humidity" value={`${day.humidity} %`} />
          <Row label="Wind speed" value={`${day.wind_speed} km/h`} />
          <Row label="Sunshine" value={orNa(day.sunshine_duration, (v) => `${(v / 3600).toFixed(1)} h`)} />
          <Row label="Cloud cover" value={orNa(day.cloud_cover, (v) => `${v} %`)} />
          {gdd && (
            <>
              <Row label="GDD (day)" value={`${gdd.gdd_daily.toFixed(2)}`} />
              <Row label="GDD (accumulated)" value={`${gdd.gdd_accumulated.toFixed(2)}`} />
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
