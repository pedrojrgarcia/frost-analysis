# Open-Meteo vs Google Earth Engine (ERA5-Land) — comparison

Data: `frost_data.db`, tables `daily_weather` (Open-Meteo) and `daily_weather_gee` (Google Earth Engine, ERA5-Land).
Location: 49.98444°N, 7.09784°E. Period: 1976-01-01 to 2026-10-24 (Open-Meteo) and 2026-10-13 (Google). 18,548 days present in both.

## Caveat

The database has no ground truth (no weather station readings), so this measures **how far the two sources disagree**, not which one is accurate. All differences below are Google minus Open-Meteo.

## Daily values, all days

| Variable | Average difference | Typical error (MAE) | RMSE | Correlation |
|---|---|---|---|---|
| min temp | −0.72 °C | 0.80 °C | 0.89 | 0.9967 |
| max temp | −1.03 °C | 1.04 °C | 1.12 | 0.9986 |
| mean temp | −0.92 °C | 0.92 °C | 0.95 | 0.9994 |
| humidity | −13.81 % | 13.82 % | 15.77 | 0.7597 |
| wind speed | −7.87 km/h | 7.87 km/h | 8.54 | 0.8971 |

- Both follow the same weather day to day, but Google is almost always colder.
- The offset is steady, not random: about −0.7 °C on minimums in every month, and about −0.9 °C on mean temperature in every decade up to the 2010s (1970s −0.90, 2010s −0.92), widening to −1.02 °C in the 2020s.
- A steady offset like this usually points to a different effective elevation: the Google value is for a roughly 9 km grid cell, while Open-Meteo most likely adjusts to the height of the exact point. About 0.9 °C corresponds to roughly 140 m of elevation. This is a hypothesis, not confirmed.

## March–May (4,692 days)

Temperature differences are the same as for all days (min −0.72, max −1.04, mean −0.92 °C).

| Measure | Open-Meteo | Google | Flagged by both |
|---|---|---|---|
| days with min < 0 °C | 622 | 866 | 615 |
| days with min < −1.5 °C | 318 | 470 | 310 |
| days with mean > 10 °C | 2,115 | 1,787 | 1,786 |

- Google reports about 40 % more frost days. Only 7 frost days (min < 0 °C) appear in Open-Meteo alone, against 251 in Google alone.
- Google has about 15 % fewer days with mean above 10 °C.

## GDD-40 milestone (first day accumulated GDD ≥ 40)

51 years compared. The date differs in every year: average gap 6.8 days, worst 25 days, and Google is always later because its colder series accumulates degree days more slowly.

| Year | Open-Meteo | Google | Gap (days) |
|---|---|---|---|
| 2021 | 2021-05-12 | 2021-05-30 | 18 |
| 2022 | 2022-05-01 | 2022-05-09 | 8 |
| 2023 | 2023-05-05 | 2023-05-10 | 5 |
| 2024 | 2024-04-08 | 2024-04-28 | 20 |
| 2025 | 2025-04-27 | 2025-04-30 | 3 |
| 2026 | 2026-04-25 | 2026-05-04 | 9 |

## Humidity and wind

These differ a lot, but they are not like-for-like, so the gap is not an accuracy measure:
- Google humidity is derived from temperature and dewpoint (Magnus formula); Open-Meteo stores the daily maximum relative humidity.
- Google wind is a daily mean of the wind components; Open-Meteo stores the daily maximum wind speed.

## Conclusion

For frost risk at this exact location, Open-Meteo is probably closer to reality, because its values seem to be adjusted to the point's elevation. This is a judgment, not something the data proves. The Google series overstates frost by roughly 0.7–1 °C and should be read as the colder-biased, conservative view of the area.

To settle it, compare both against real station data, for example the German Weather Service (DWD) daily temperatures from a nearby station, and compute each model's actual error.
