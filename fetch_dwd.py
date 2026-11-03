import argparse
import csv
import math
import re
import sys
from datetime import datetime
from pathlib import Path

import requests

BASE_URL = "https://opendata.dwd.de/climate_environment/CDC/observations_germany/phenology/annual_reporters/vine"
STATION_FILE = f"{BASE_URL}/historical/PH_Beschreibung_Phaenologie_Stationen_Jahresmelder.txt"
DATA_DIRS = ["historical", "recent"]
DATA_PREFIX = "PH_Jahresmelder_Weinrebe_Weinrebe_"  # one file per ripening class and period
BUDBREAK_PHASE = 3  # "Austrieb Beginn"
OK_QUALITY_BYTES = {0, 1, 2, 3}  # not unchecked-doubtful (5), invalid (7) or wrong (8)
OUT_FILE = Path("data") / "dwd_budbreak.csv"


def get_text(url):
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    return response.content.decode("latin-1")


def distance_km(lat1, lon1, lat2, lon2):
    """Great-circle distance (haversine)."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = (math.sin((p2 - p1) / 2) ** 2
         + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2)
    return 2 * 6371.0 * math.asin(math.sqrt(a))


def nearby_stations(lat, lon, radius):
    """{station id: (name, distance_km, height_m)} for stations within radius km."""
    stations = {}
    for line in get_text(STATION_FILE).splitlines():
        parts = [p.strip() for p in line.split(";")]
        if len(parts) < 5 or not parts[0].isdigit():
            continue
        dist = distance_km(lat, lon, float(parts[2]), float(parts[3]))
        if dist <= radius:
            stations[int(parts[0])] = (parts[1], dist, int(float(parts[4])))
    return stations


def data_urls():
    urls = []
    for directory in DATA_DIRS:
        listing = get_text(f"{BASE_URL}/{directory}/")
        for name in re.findall(r'href="([^"]+\.txt)"', listing):
            if name.startswith(DATA_PREFIX):
                urls.append(f"{BASE_URL}/{directory}/{name}")
    return urls


def budbreak_records(urls, station_ids):
    """{(year, station id): earliest budbreak date} from all data files."""
    found = {}
    for url in urls:
        print(f"Reading {url.rsplit('/', 1)[1]}")
        for line in get_text(url).splitlines():
            parts = [p.strip() for p in line.split(";")]
            if len(parts) < 8 or not parts[0].isdigit():
                continue
            station, year, phase, quality = int(parts[0]), int(parts[1]), int(parts[4]), int(parts[6])
            if station not in station_ids or phase != BUDBREAK_PHASE or quality not in OK_QUALITY_BYTES:
                continue
            day = datetime.strptime(parts[5], "%Y%m%d").date()
            # several ripening classes at one station and year: keep the earliest date
            if (year, station) not in found or day < found[(year, station)]:
                found[(year, station)] = day
    return found


def main():
    parser = argparse.ArgumentParser(description="Download DWD grapevine budbreak observations near a location.")
    parser.add_argument("--lat", type=float, required=True, help="Latitude")
    parser.add_argument("--lon", type=float, required=True, help="Longitude")
    parser.add_argument("--radius", type=float, default=30, help="Radius in km (default: 30)")
    args = parser.parse_args()

    stations = nearby_stations(args.lat, args.lon, args.radius)
    if not stations:
        print(f"No DWD station within {args.radius:g} km of {args.lat}, {args.lon}. No file written.")
        sys.exit(1)
    print(f"{len(stations)} stations within {args.radius:g} km.")

    found = budbreak_records(data_urls(), stations)
    if not found:
        print(f"No grapevine budbreak observations at the {len(stations)} stations within "
              f"{args.radius:g} km. No file written.")
        sys.exit(1)

    rows = sorted(
        ((year, *stations[sid][:1], round(stations[sid][1], 1), stations[sid][2], day.isoformat())
         for (year, sid), day in found.items()),
        key=lambda r: (r[0], r[2], r[1]),
    )
    OUT_FILE.parent.mkdir(exist_ok=True)
    with open(OUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["year", "station", "distance_km", "height_m", "budbreak_date"])
        writer.writerows(rows)
    print(f"Done. {len(rows)} rows ({len({r[1] for r in rows})} stations, "
          f"{rows[0][0]}-{rows[-1][0]}) written to {OUT_FILE}")


if __name__ == "__main__":
    main()
