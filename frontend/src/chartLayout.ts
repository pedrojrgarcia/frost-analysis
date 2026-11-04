import { useEffect, useState } from "react";

// Shared layout for the two frost charts, so they always have the same width.
export const CHART_MAX_WIDTH = 720;
export const CHART_MAX_STEP = 30; // px per year at most, so few years are not spread out
export const CHART_MARGIN_LEFT = 44; // room for the y-axis numbers and the "frost nights" title
export const CHART_MARGIN_RIGHT = 12;
const MIN_LABEL_SPACING = 38; // px between year labels, so they never overlap

// x-layout for `years` years in a box of `boxWidth` px
export function chartLayout(boxWidth: number, years: number) {
  const available = Math.min(boxWidth || CHART_MAX_WIDTH, CHART_MAX_WIDTH) - CHART_MARGIN_LEFT - CHART_MARGIN_RIGHT;
  const step = Math.min(CHART_MAX_STEP, available / Math.max(1, years));
  const plotWidth = step * years;
  const width = CHART_MARGIN_LEFT + plotWidth + CHART_MARGIN_RIGHT;
  // smallest of 1, 2, 5, 10, 20 years that keeps year labels apart
  const labelEvery = [1, 2, 5, 10, 20].find((n) => n * step >= MIN_LABEL_SPACING) ?? 20;
  return { step, plotWidth, width, labelEvery };
}

// width of the element the chart lives in; use the returned setter as `ref`
export function useBoxWidth() {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!box) return;
    setWidth(box.clientWidth);
    const observer = new ResizeObserver(() => setWidth(box.clientWidth));
    observer.observe(box);
    return () => observer.disconnect();
  }, [box]);
  return [setBox, width] as const;
}
