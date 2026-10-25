const API_BASE = "http://localhost:5001";

export type Source = "open_meteo" | "gee";

export const SOURCE_LABELS: Record<Source, string> = {
  open_meteo: "Open-Meteo",
  gee: "Google Earth Engine (ERA5-Land)",
};

export interface WeatherDay {
  date: string;
  temp_min: number;
  temp_max: number;
  temp_mean: number;
  humidity: number;
  wind_speed: number;
  sunshine_duration: number | null;
  cloud_cover: number | null;
}

export interface GddDay {
  date: string;
  year: number;
  gdd_daily: number;
  gdd_accumulated: number;
}

export interface GddMilestone {
  year: number;
  milestone_date: string;
}

async function getJson<T>(path: string, source: Source, yearFrom: number, yearTo: number): Promise<T> {
  const res = await fetch(
    `${API_BASE}/${path}?source=${source}&year_from=${yearFrom}&year_to=${yearTo}`
  );
  if (!res.ok) {
    throw new Error(`${path} (${source}) failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function fetchWeather(source: Source, yearFrom: number, yearTo: number): Promise<WeatherDay[]> {
  return getJson("weather", source, yearFrom, yearTo);
}

export function fetchGdd(source: Source, yearFrom: number, yearTo: number): Promise<GddDay[]> {
  return getJson("gdd", source, yearFrom, yearTo);
}

export function fetchGddMilestones(source: Source, yearFrom: number, yearTo: number): Promise<GddMilestone[]> {
  return getJson("gdd-milestone", source, yearFrom, yearTo);
}
