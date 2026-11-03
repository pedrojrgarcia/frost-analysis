import { Terrain } from "./api";

interface Props {
  terrain: Terrain | null;
}

const STEEP_SLOPE_PERCENT = 30;

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ color: "#666" }}>{label}: </span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export default function PlotBox({ terrain }: Props) {
  const box = { padding: 12, background: "#f6f6f6", borderRadius: 4, fontSize: 13, lineHeight: 1.5 };

  if (!terrain) {
    return <div style={{ ...box, color: "#999" }}>No terrain data yet. Run terrain.py.</div>;
  }

  const title = [terrain.name, terrain.ort].filter(Boolean).join(", ");
  const steep = terrain.slope_mean_percent >= STEEP_SLOPE_PERCENT;

  return (
    <div style={box}>
      <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>
        Plot{title && `: ${title}`}
        {steep && (
          <span
            style={{
              marginLeft: 8,
              padding: "1px 6px",
              background: "#c0392b",
              color: "#fff",
              borderRadius: 3,
              fontSize: 11,
              fontWeight: "normal",
            }}
          >
            steep slope
          </span>
        )}
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 16 }}>
        <Item label="Area" value={`${terrain.area_ha.toFixed(2)} ha`} />
        <Item
          label="Mean slope"
          value={`${terrain.slope_mean_deg.toFixed(1)}° (${terrain.slope_mean_percent.toFixed(1)} %)`}
        />
        <Item label="Elevation" value={`${terrain.elevation_min_m.toFixed(0)}–${terrain.elevation_max_m.toFixed(0)} m`} />
        <Item
          label="Mean aspect"
          value={
            terrain.aspect_mean_deg === null
              ? "n/a"
              : `${terrain.aspect_mean_deg}° (${terrain.aspect_compass})`
          }
        />
        <Item label="Mean elevation" value={`${terrain.elevation_mean_m.toFixed(1)} m`} />
        <Item label="Elevation difference" value={`${terrain.elevation_diff_m.toFixed(1)} m`} />
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: "#666" }}>
        DGM1 RLP 1 m (2023), ©GeoBasis-DE / LVermGeoRP, dl-de/by-2-0
      </div>
    </div>
  );
}
