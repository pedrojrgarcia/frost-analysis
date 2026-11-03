import { FrostSummary } from "./api";

interface Props {
  summary: FrostSummary[];
}

const RADIATION_COLOR = "#2a6fbb";
const ADVECTION_COLOR = "#e08a1e";
const INK = "#333";
const MUTED = "#666";
const GRID = "#e4e4e4";

const BAR_STEP = 44;
const BAR_WIDTH = 28;
const PLOT_HEIGHT = 160;
const MARGIN = { top: 28, right: 12, bottom: 28, left: 32 };

function summaryLine(summary: FrostSummary[]): string {
  const years = summary.map((s) => s.year);
  const first = Math.min(...years);
  const last = Math.max(...years);
  const range = first === last ? String(first) : `${first}–${last}`;
  const withFrost = summary.filter((s) => (s.frost_nights ?? 0) > 0).length;
  const severeYears = summary.filter((s) => (s.severe_frost_nights ?? 0) > 0).map((s) => s.year);
  const radiation = summary.reduce((sum, s) => sum + (s.radiation_nights ?? 0), 0);
  const advection = summary.reduce((sum, s) => sum + (s.advection_nights ?? 0), 0);
  const severe =
    severeYears.length === 0 ? "none with severe frost" : `${severeYears.length} with severe frost (${severeYears.join(", ")})`;
  return `${range}: ${withFrost} of ${summary.length} years with frost after budbreak, ${severe}. ${radiation} radiation and ${advection} advection nights.`;
}

export default function FrostChart({ summary }: Props) {
  if (summary.length === 0) return null;

  const maxNights = Math.max(1, ...summary.map((s) => s.frost_nights ?? 0));
  const yMax = maxNights <= 5 ? maxNights : Math.ceil(maxNights / 5) * 5;
  const tickStep = yMax <= 5 ? 1 : 5;
  const ticks: number[] = [];
  for (let t = 0; t <= yMax; t += tickStep) ticks.push(t);

  const plotWidth = summary.length * BAR_STEP;
  const width = MARGIN.left + plotWidth + MARGIN.right;
  const height = MARGIN.top + PLOT_HEIGHT + MARGIN.bottom;
  const y = (n: number) => MARGIN.top + PLOT_HEIGHT - (n / yMax) * PLOT_HEIGHT;

  return (
    <div style={{ fontSize: 13 }}>
      <p style={{ margin: "0 0 12px", lineHeight: 1.4 }}>{summaryLine(summary)}</p>
      <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Frost nights after budbreak per year</h3>
      <div style={{ overflowX: "auto" }}>
        <svg width={width} height={height} role="img" aria-label="Frost nights after budbreak per year">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={y(t)} y2={y(t)} stroke={GRID} />
              <text x={MARGIN.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={MUTED}>
                {t}
              </text>
            </g>
          ))}
          {summary.map((s, i) => {
            const x = MARGIN.left + i * BAR_STEP + (BAR_STEP - BAR_WIDTH) / 2;
            const cx = x + BAR_WIDTH / 2;
            const total = s.frost_nights;
            const rad = s.radiation_nights ?? 0;
            const adv = s.advection_nights ?? 0;
            const severe = (s.severe_frost_nights ?? 0) > 0;
            const top = y(total ?? 0);
            const radTop = y(rad);
            const advTop = y(rad + adv);
            const tip =
              total === null
                ? `${s.year}: no budbreak date`
                : `${s.year}: ${total} frost nights (${rad} radiation, ${adv} advection), ${s.severe_frost_nights ?? 0} severe`;
            return (
              <g key={s.year}>
                <title>{tip}</title>
                {rad > 0 && (
                  <rect x={x} y={radTop} width={BAR_WIDTH} height={y(0) - radTop} fill={RADIATION_COLOR} />
                )}
                {adv > 0 && (
                  <rect
                    x={x}
                    y={advTop}
                    width={BAR_WIDTH}
                    height={radTop - advTop - (rad > 0 ? 2 : 0)}
                    fill={ADVECTION_COLOR}
                  />
                )}
                {severe && (
                  <rect
                    x={x - 1.5}
                    y={top - 1.5}
                    width={BAR_WIDTH + 3}
                    height={y(0) - top + 3}
                    fill="none"
                    stroke={INK}
                    strokeWidth={2}
                  />
                )}
                <text x={cx} y={top - 5} textAnchor="middle" fontSize={11} fill={INK}>
                  {total === null ? "–" : total}
                </text>
                {severe && (
                  <path d={`M ${cx - 4} ${top - 22} L ${cx + 4} ${top - 22} L ${cx} ${top - 15} Z`} fill={INK} />
                )}
                <text x={cx} y={y(0) + 16} textAnchor="middle" fontSize={11} fill={MUTED}>
                  {s.year}
                </text>
              </g>
            );
          })}
          <line x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={y(0)} y2={y(0)} stroke="#999" />
        </svg>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginTop: 4, color: INK }}>
        <span>
          <span style={swatch(RADIATION_COLOR)} /> Radiation nights
        </span>
        <span>
          <span style={swatch(ADVECTION_COLOR)} /> Advection nights
        </span>
        <span>
          <span style={{ ...swatch("transparent"), border: `2px solid ${INK}` }} /> Dark outline and ▼ = at least one
          severe frost night (≤ −1.5 °C)
        </span>
      </div>
    </div>
  );
}

function swatch(color: string) {
  return {
    display: "inline-block",
    width: 12,
    height: 12,
    boxSizing: "border-box" as const,
    background: color,
    verticalAlign: "-1px",
  };
}
