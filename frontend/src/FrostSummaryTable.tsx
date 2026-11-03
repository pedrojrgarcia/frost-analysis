import { FrostSummary } from "./api";

interface Props {
  summary: FrostSummary[];
}

const cell = { padding: "4px 10px", textAlign: "right" as const, whiteSpace: "nowrap" as const };
const headCell = { ...cell, borderBottom: "1px solid #ccc", color: "#666", fontWeight: 500 };

function num(value: number | null): string {
  return value === null ? "–" : String(value);
}

export default function FrostSummaryTable({ summary }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: 13 }}>
      <div style={{ overflowX: "auto" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Frost nights after budbreak (up to 30 June)</h3>
        <table style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={headCell}>Year</th>
              <th style={headCell}>Budbreak</th>
              <th style={headCell}>Source</th>
              <th style={headCell}>Frost ≤ 0 °C</th>
              <th style={headCell}>Severe ≤ −1.5 °C</th>
              <th style={headCell}>Radiation</th>
              <th style={headCell}>Advection</th>
              <th style={headCell}>Coldest night</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((s) => (
              <tr key={s.year}>
                <td style={cell}>{s.year}</td>
                <td style={cell}>{s.budbreak_date ?? "–"}</td>
                <td style={cell}>
                  {s.budbreak_source
                    ? s.budbreak_station_distance_km === null
                      ? s.budbreak_source
                      : `${s.budbreak_source} (${s.budbreak_station_distance_km.toFixed(1)} km)`
                    : "–"}
                </td>
                <td style={cell}>{num(s.frost_nights)}</td>
                <td style={cell}>{num(s.severe_frost_nights)}</td>
                <td style={cell}>{num(s.radiation_nights)}</td>
                <td style={cell}>{num(s.advection_nights)}</td>
                <td style={cell}>
                  {s.coldest_night_date ? `${s.coldest_night_date} (${s.coldest_night_temp} °C)` : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ maxWidth: 420, padding: 12, background: "#f6f6f6", borderRadius: 4, lineHeight: 1.4 }}>
        <p style={{ margin: "0 0 8px" }}>
          <b>Radiation frost:</b> clear, calm night (wind &lt; 10 km/h at 10 m height (about 5 km/h near the buds), clouds &lt; 20 %). The ground loses heat
          to the sky and cold air collects low, so terrain matters (hollows freeze first).
        </p>
        <p style={{ margin: "0 0 8px" }}>
          <b>Advection frost:</b> a cold air mass with wind or clouds. The whole area is cold, so terrain matters
          little.
        </p>
        <p style={{ margin: 0, color: "#666" }}>
          Note: wind is measured at 10 m, so near the buds it is usually calmer.
        </p>
      </div>
    </div>
  );
}
