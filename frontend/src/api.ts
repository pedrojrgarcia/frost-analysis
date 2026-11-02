const API_BASE = "http://localhost:5001";

export interface WeatherDay {
  date: string;
  temp_min: number;
  temp_max: number;
  temp_mean: number;
  humidity: number;
  wind_speed: number;
  sunshine_duration: number;
  cloud_cover: number;
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

async function getJson<T>(path: string, yearFrom: number, yearTo: number): Promise<T> {
  const res = await fetch(
    `${API_BASE}/${path}?year_from=${yearFrom}&year_to=${yearTo}`
  );
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function fetchWeather(yearFrom: number, yearTo: number): Promise<WeatherDay[]> {
  return getJson("weather", yearFrom, yearTo);
}

export function fetchGdd(yearFrom: number, yearTo: number): Promise<GddDay[]> {
  return getJson("gdd", yearFrom, yearTo);
}

export function fetchGddMilestones(yearFrom: number, yearTo: number): Promise<GddMilestone[]> {
  return getJson("gdd-milestone", yearFrom, yearTo);
}
