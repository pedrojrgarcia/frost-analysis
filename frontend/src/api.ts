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

export async function fetchWeather(
  yearFrom: number,
  yearTo: number
): Promise<WeatherDay[]> {
  const res = await fetch(
    `${API_BASE}/weather?year_from=${yearFrom}&year_to=${yearTo}`
  );
  return res.json();
}

export async function fetchGdd(
  yearFrom: number,
  yearTo: number
): Promise<GddDay[]> {
  const res = await fetch(
    `${API_BASE}/gdd?year_from=${yearFrom}&year_to=${yearTo}`
  );
  return res.json();
}

export async function fetchGddMilestones(
  yearFrom: number,
  yearTo: number
): Promise<GddMilestone[]> {
  const res = await fetch(
    `${API_BASE}/gdd-milestone?year_from=${yearFrom}&year_to=${yearTo}`
  );
  return res.json();
}
