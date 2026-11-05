const API_BASE = "http://localhost:5001";

export interface Day {
  date: string;
  tmax: number;
  tmin: number;
  gdd: number;
  gdd_accumulated: number;
  humidity_mean: number | null;
  wind_max: number | null;
  sunshine_hours: number | null;
  cloud_mean: number | null;
  night_min: number | null;
  night_min_hour: number | null;
  night_wind_mean: number | null;
  night_cloud_mean: number | null;
  frost_type: "radiation" | "advection" | null;
}

export interface GddMilestone {
  year: number;
  milestone_date: string;
}

export interface DwdBudbreak {
  year: number;
  station: string;
  distance_km: number;
  height_m: number;
  budbreak_date: string;
}

export interface FrostSummary {
  year: number;
  budbreak_date: string | null;
  budbreak_source: string | null;
  budbreak_station_distance_km: number | null;
  frost_nights: number | null;
  severe_frost_nights: number | null;
  radiation_nights: number | null;
  advection_nights: number | null;
  coldest_night_date: string | null;
  coldest_night_temp: number | null;
}

export interface Terrain {
  name: string | null;
  ort: string | null;
  area_ha: number;
  elevation_min_m: number;
  elevation_max_m: number;
  elevation_mean_m: number;
  elevation_diff_m: number;
  slope_mean_deg: number;
  slope_mean_percent: number;
  aspect_mean_deg: number | null;
  aspect_compass: string | null;
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

export function fetchDays(yearFrom: number, yearTo: number): Promise<Day[]> {
  return getJson("days", yearFrom, yearTo);
}

export function fetchDwdBudbreak(yearFrom: number, yearTo: number): Promise<DwdBudbreak[]> {
  return getJson("dwd-budbreak", yearFrom, yearTo);
}

export function fetchFrostSummary(yearFrom: number, yearTo: number): Promise<FrostSummary[]> {
  return getJson("frost-summary", yearFrom, yearTo);
}

// null when terrain.json does not exist yet (the API answers 404)
export async function fetchTerrain(): Promise<Terrain | null> {
  const res = await fetch(`${API_BASE}/terrain`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`terrain failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function fetchGddMilestones(yearFrom: number, yearTo: number): Promise<GddMilestone[]> {
  return getJson("gdd-milestone", yearFrom, yearTo);
}

export interface StationDay {
  date: string;
  tmin: number | null; // 2 m
  tmax: number | null; // 2 m
  gdd: number | null;
  gdd_accumulated: number; // from 1 January, missing days add nothing
  night_min_2m: number | null;
  night_min_20cm: number | null;
  night_wind_mean: number | null; // km/h at 2.5 m
}

export function fetchStationDays(yearFrom: number, yearTo: number): Promise<StationDay[]> {
  return getJson("station-days", yearFrom, yearTo);
}
