import { FrostSummary } from "./api";
import { CHART_MARGIN_LEFT, CHART_MARGIN_RIGHT, CHART_MAX_WIDTH, chartLayout, useBoxWidth } from "./chartLayout";

export interface StationCount {
  frost: number;
  severe: number;
}

interface Props {
  summary: FrostSummary[];
  // optional second bar per year: frost nights at the station (same budbreak date as ERA5)
  station?: Map<number, StationCount | null>;
  stationLabel?: string;
}

const RADIATION_COLOR = "#2a6fbb";
const ADVECTION_COLOR = "#e08a1e";
const STATION_COLOR = "#9a9a9a";
const STATION_SEVERE_COLOR = "#3d3d3d";
const INK = "#333";
const MUTED = "#666";
const GRID = "#e4e4e4";

const PLOT_HEIGHT = 160;
const MARGIN = { top: 28, right: CHART_MARGIN_RIGHT, bottom: 28, left: CHART_MARGIN_LEFT };

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

export default function FrostChart({ summary, station, stationLabel }: Props) {
  const [boxRef, boxWidth] = useBoxWidth();
  if (summary.length === 0) return null;

  const hasStation = !!station && [...station.values()].some((v) => v !== null);
  const maxNights = Math.max(
    1,
    ...summary.map((s) => s.frost_nights ?? 0),
    ...(hasStation ? [...station!.values()].map((v) => v?.frost ?? 0) : [])
  );
  const yMax = maxNights <= 5 ? maxNights : Math.ceil(maxNights / 5) * 5;
  const tickStep = yMax <= 5 ? 1 : 5;
  const ticks: number[] = [];
  for (let t = 0; t <= yMax; t += tickStep) ticks.push(t);

  const { step, plotWidth, width, labelEvery } = chartLayout(boxWidth, summary.length);
  // with the station: two thinner bars side by side (left ERA5, right station)
  const barWidth = hasStation ? step * 0.4 : step * 0.64;
  const pairGap = hasStation ? step * 0.06 : 0;
  const showValues = (hasStation ? barWidth : step) >= 16 * (hasStation ? 0.6 : 1); // numbers only when there is room
  const height = MARGIN.top + PLOT_HEIGHT + MARGIN.bottom;
  const y = (n: number) => MARGIN.top + PLOT_HEIGHT - (n / yMax) * PLOT_HEIGHT;

  return (
    <div style={{ fontSize: 13 }}>
      <p style={{ margin: "0 0 12px", lineHeight: 1.4 }}>{summaryLine(summary)}</p>
      <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Frost nights after budbreak per year</h3>
      <div ref={boxRef} style={{ width: "100%", maxWidth: CHART_MAX_WIDTH }}>
        <svg width={width} height={height} role="img" aria-label="Frost nights after budbreak per year">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={y(t)} y2={y(t)} stroke={GRID} />
              <text x={MARGIN.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={MUTED}>
                {t}
              </text>
            </g>
          ))}
          <text
            transform={`translate(12, ${MARGIN.top + PLOT_HEIGHT / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={11}
            fill={MUTED}
          >
            frost nights
          </text>
          {summary.map((s, i) => {
            const groupWidth = hasStation ? barWidth * 2 + pairGap : barWidth;
            const x = MARGIN.left + i * step + (step - groupWidth) / 2;
            const cx = x + barWidth / 2;
            const yearCx = MARGIN.left + i * step + step / 2;
            const st = hasStation ? (station!.get(s.year) ?? null) : null;
            const sx = x + barWidth + pairGap;
            const sTop = y(st?.frost ?? 0);
            const sSevereTop = y(st?.severe ?? 0);
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
                : `${s.year}: ERA5 ${total} frost nights (${rad} radiation, ${adv} advection), ${s.severe_frost_nights ?? 0} severe`;
            const stationTip = !hasStation
              ? ""
              : st === null
                ? "\nStation: no data"
                : `\nStation: ${st.frost} frost nights, ${st.severe} severe`;
            return (
              <g key={s.year}>
                <title>{tip + stationTip}</title>
                {rad > 0 && (
                  <rect x={x} y={radTop} width={barWidth} height={y(0) - radTop} fill={RADIATION_COLOR} />
                )}
                {adv > 0 && (
                  <rect
                    x={x}
                    y={advTop}
                    width={barWidth}
                    height={radTop - advTop - (rad > 0 ? 2 : 0)}
                    fill={ADVECTION_COLOR}
                  />
                )}
                {severe && (
                  <rect
                    x={x - 1.5}
                    y={top - 1.5}
                    width={barWidth + 3}
                    height={y(0) - top + 3}
                    fill="none"
                    stroke={INK}
                    strokeWidth={2}
                  />
                )}
                {showValues && (
                  <text x={cx} y={top - 5} textAnchor="middle" fontSize={11} fill={INK}>
                    {total === null ? "–" : total}
                  </text>
                )}
                {severe && (
                  <path d={`M ${cx - 4} ${top - 22} L ${cx + 4} ${top - 22} L ${cx} ${top - 15} Z`} fill={INK} />
                )}
                {st && st.frost > 0 && (
                  <rect x={sx} y={sTop} width={barWidth} height={y(0) - sTop} fill={STATION_COLOR} />
                )}
                {st && st.severe > 0 && (
                  <rect x={sx} y={sSevereTop} width={barWidth} height={y(0) - sSevereTop} fill={STATION_SEVERE_COLOR} />
                )}
                {hasStation && showValues && st && (
                  <text x={sx + barWidth / 2} y={sTop - 5} textAnchor="middle" fontSize={10} fill={MUTED}>
                    {st.frost}
                  </text>
                )}
                {s.year % labelEvery === 0 && (
                  <text x={hasStation ? yearCx : cx} y={y(0) + 16} textAnchor="middle" fontSize={11} fill={MUTED}>
                    {s.year}
                  </text>
                )}
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
        {hasStation && (
          <span>
            Left bar = ERA5 · right bar = {stationLabel ?? "station"}:{" "}
            <span style={swatch(STATION_COLOR)} /> frost nights,{" "}
            <span style={swatch(STATION_SEVERE_COLOR)} /> of them severe
          </span>
        )}
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
