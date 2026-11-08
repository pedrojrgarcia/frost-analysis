import { FrostSummary } from "./api";
import { CHART_MARGIN_LEFT, CHART_MARGIN_RIGHT, CHART_MAX_WIDTH, chartLayout, useBoxWidth } from "./chartLayout";

interface Props {
  summary: FrostSummary[]; // the selected years
  history: FrostSummary[]; // the selected years plus the years before, for the average
}

// same colours as the calendar: light blue = frost night, dark blue = severe frost night
const FROST_COLOR = "#85c1e9";
const SEVERE_COLOR = "#1a5276";
const AVERAGE_COLOR = "#7a1f2b";
const INK = "#222";
const MUTED = "#6b6b6b";
const GRID = "#ececec";

const AVERAGE_YEARS = 10;
const PLOT_HEIGHT = 130;
const MARGIN = { top: 14, right: CHART_MARGIN_RIGHT, bottom: 32, left: CHART_MARGIN_LEFT };

const MIN_AVERAGE_YEARS = 3; // at the start of the data (1976) fewer years exist

// mean frost nights per year over the last AVERAGE_YEARS years, also using years before the selection;
// years without data are left out, null when fewer than MIN_AVERAGE_YEARS years have data
function movingAverage(summary: FrostSummary[], history: FrostSummary[]): (number | null)[] {
  return summary.map((s) => {
    const window = history.filter(
      (h) => h.year > s.year - AVERAGE_YEARS && h.year <= s.year && h.frost_nights !== null
    );
    if (window.length < MIN_AVERAGE_YEARS) return null;
    return window.reduce((sum, h) => sum + (h.frost_nights ?? 0), 0) / window.length;
  });
}

export default function FrostHistoryChart({ summary, history }: Props) {
  const [boxRef, boxWidth] = useBoxWidth();

  if (summary.length === 0) return null;

  const first = summary[0].year;
  const last = summary[summary.length - 1].year;
  const withFrost = summary.filter((s) => (s.frost_nights ?? 0) > 0).length;
  const severeYears = summary.filter((s) => (s.severe_frost_nights ?? 0) > 0).map((s) => s.year);
  const severeNights = summary.reduce((sum, s) => sum + (s.severe_frost_nights ?? 0), 0);
  const frostNights = summary.reduce((sum, s) => sum + (s.frost_nights ?? 0), 0);
  const modelYears = summary.filter((s) => s.budbreak_source === "model").length;

  // same width rule as the bar chart (chartLayout.ts)
  const { step, plotWidth, width, labelEvery: every } = chartLayout(boxWidth, summary.length);
  const maxNights = Math.max(3, ...summary.map((s) => s.frost_nights ?? 0));
  // the y-scale always fills the plot height; only the dot size shrinks when years get narrow
  const dotStep = PLOT_HEIGHT / (maxNights + 1.2);
  const radius = Math.max(2.5, Math.min(dotStep * 0.4, step * 0.38, 5));
  const baseY = MARGIN.top + PLOT_HEIGHT;
  const height = baseY + MARGIN.bottom;
  const xFor = (i: number) => MARGIN.left + (i + 0.5) * step;
  const yFor = (n: number) => baseY - n * dotStep;

  const averages = movingAverage(summary, history);
  const averagePoints = averages
    .map((a, i) => (a === null ? null : `${xFor(i).toFixed(1)},${yFor(a).toFixed(1)}`))
    .filter((p): p is string => p !== null);
  const lastAverage = averages[averages.length - 1];

  const ticks: number[] = [];
  for (let t = 0; t <= maxNights; t += maxNights > 6 ? 2 : 1) ticks.push(t);

  return (
    // measure the available width outside; title, text, chart and legend all get the chart width
    <div ref={boxRef} style={{ fontSize: 13, width: "100%", maxWidth: CHART_MAX_WIDTH }}>
      <div style={{ width, maxWidth: "100%" }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>
        Frostnächte nach dem Austrieb, {first}–{last} (ein Punkt pro Nacht)
      </h3>
      <p style={{ margin: "0 0 8px", lineHeight: 1.4 }}>
        {withFrost} von {summary.length} Jahren mit Frost, {severeYears.length} mit starkem Frost.{" "}
        {frostNights} Frostnächte, davon {severeNights} stark.
      </p>
      <div>
        <svg width={width} height={height} role="img" aria-label="Frost nights after budbreak per year, as dots">
          {/* thin vertical guide at each labelled year */}
          {summary.map((s, i) =>
            s.year % every === 0 ? (
              <line key={`guide-${s.year}`} x1={xFor(i)} x2={xFor(i)} y1={MARGIN.top} y2={baseY} stroke={GRID} />
            ) : null
          )}

          {ticks.map((t) => (
            <g key={t}>
              <line x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={yFor(t)} y2={yFor(t)} stroke={GRID} />
              <text x={MARGIN.left - 8} y={yFor(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={MUTED}>
                {t}
              </text>
            </g>
          ))}
          <text
            transform={`translate(13, ${MARGIN.top + PLOT_HEIGHT / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={11}
            fill={MUTED}
          >
            Frostnächte
          </text>

          {summary.map((s, i) => {
            const cx = xFor(i);
            const total = s.frost_nights ?? 0;
            const severeCount = s.severe_frost_nights ?? 0;
            // one dot per frost night: severe nights at the bottom, the other frost nights on top
            const colors = [...Array(severeCount).fill(SEVERE_COLOR), ...Array(total - severeCount).fill(FROST_COLOR)];
            const tip =
              s.frost_nights === null
                ? `${s.year}: kein Austriebsdatum`
                : `${s.year}: ${total} Frostnächte, davon ${severeCount} stark. ` +
                  `Austrieb ${s.budbreak_date} (${s.budbreak_source === "model" ? "Modell" : s.budbreak_source})`;
            return (
              <g key={s.year}>
                <title>{tip}</title>
                <rect x={MARGIN.left + i * step} y={MARGIN.top} width={step} height={PLOT_HEIGHT} fill="transparent" />
                {colors.map((color, k) => (
                  <circle key={k} cx={cx} cy={yFor(k + 0.5)} r={radius} fill={color} stroke="#fff" strokeWidth={1} />
                ))}
                {s.budbreak_source === "model" && (
                  <circle cx={cx} cy={baseY + 7} r={2} fill="#b5b5b5" />
                )}
                {(s.year % every === 0 || summary.length === 1) && (
                  <>
                    <line x1={cx} x2={cx} y1={baseY} y2={baseY + 4} stroke="#999" />
                    <text x={cx} y={baseY + 22} textAnchor="middle" fontSize={10} fill={MUTED}>
                      {s.year}
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {averagePoints.length > 1 && (
            <polyline
              points={averagePoints.join(" ")}
              fill="none"
              stroke={AVERAGE_COLOR}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.85}
            />
          )}
          <line x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={baseY} y2={baseY} stroke="#9a9a9a" />
        </svg>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 2, fontSize: 12, color: INK, maxWidth: CHART_MAX_WIDTH }}>
        <span>
          <span style={dot(FROST_COLOR)} /> Frostnacht (≤ 0 °C)
        </span>
        <span>
          <span style={dot(SEVERE_COLOR)} /> Starke Frostnacht (≤ −1,5 °C)
        </span>
        {averagePoints.length > 1 && (
          <span>
            <span style={{ display: "inline-block", width: 18, height: 3, borderRadius: 2, background: AVERAGE_COLOR, verticalAlign: "3px" }} />{" "}
            Frostnächte pro Jahr, Mittel über {AVERAGE_YEARS} Jahre
            {lastAverage !== null && ` (zuletzt: ${lastAverage.toFixed(1).replace(".", ",")})`}
          </span>
        )}
        {modelYears > 0 && (
          <span style={{ color: MUTED }}>
            <span style={dot("#b5b5b5", 6)} /> Austrieb aus dem Modell ({modelYears} {modelYears === 1 ? "Jahr" : "Jahre"} ohne DWD-Datum im Tal)
          </span>
        )}
      </div>
      </div>
    </div>
  );
}

function dot(color: string, size = 11) {
  return {
    display: "inline-block",
    width: size,
    height: size,
    borderRadius: "50%",
    background: color,
    verticalAlign: "-1px",
  };
}
