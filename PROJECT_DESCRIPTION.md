# Frost risk analysis over a specific area

## Data collection

Given a location (lat-lon), download the historical hourly data (50 years) of the following data points:
- Temperature (ERA5-Land): daily minimum and maximum, and the minimum of the night (from 20:00 to 8:00)
- Humidity (ERA5-Land): daily average
- Sunlight (ERA5): daily hours
- Cloud coverage (ERA5): daily and night average, to know if the night was clear
- Wind speed (ERA5): daily maximum and night average, to know if the night was calm

Data should come from the free API of open-meteo.com, always from the same model for each data point.
ERA5-Land has no sunlight, cloud coverage or wind in open-meteo, so these come from ERA5.

The data should be saved locally in a local database

## Data analysis

I want to calculate the accumulated daily temperatures over 7.5 degrees in excess from 
January for every year, using the average of the daily minimum and maximum. For example: if there were two days with 8.5,
one day with 6, one day with 12.5 and another one with 10.5, the accumulate for that specific day would be 10.

We want to know the day when the accumulate reached 40 for every year.
If the DWD (German weather service) observed the real budbreak date that year, we also want that date.

A night is a frost night if its minimum is 0 degrees or less. It is radiation frost if the night was calm
(wind under 10 km/h) and clear (cloud coverage under 20%), otherwise advection frost.


## Data visualization

I want a react, vite and typescript front end to display the following analysis:

- Given the data in the database
- Given a year range that we can specify in the UI
- Give me the data for every day between December of the year before and October, highlighted in a timeline, or calendar view,
where any of these situations happened:
a) night minimum temperature of 0 degrees Celsius or less (with color light blue)
b) night minimum temperature of -1.5 degrees Celsius or less (with color dark blue)
c) the accumulate reached 40 degrees (with color red)
d) mean temperature over 7.5 degrees Celsius (with color yellow)
e) the budbreak date observed by the DWD (with color green)

Clicking on a day displays all available data for that day (day and night) in a side panel to the right.
