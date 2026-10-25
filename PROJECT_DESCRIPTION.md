# Frost risk analysis over a specific area

## Data collection

Given a location (lat-lon), download the historical data (25 years) of the following data points:
- Daily minimum temperature
- Daily maximum temperature
- Daily Humidity
- Daily Sunlight (if available) or cloud coverage
- Daily Wind speed

Data should come from the free API of open-meteo.com

The data should be saved locally in a local database

## Data analysis

I want to calculate the accumulated daily temperatures over 10 degrees in excess from 
January for every year. For example: if there were two days with 11, one day with 8,
one day with 15 and another one with 13, the accumulate for that specific day would be 10.

We want to know the day when the accumulate reached 40 for every year.


## Data visualization

I want a react, vite and typescript front end to display the following analysis:

- Given the data in the database
- Given a year range that we can specify in the UI
- Give me the data for every day between March and May, highlighted in a timeline, or calendar view,
where any of these situations happened:
a) minimum temperature with less than 0 degrees Celsius (with color light blue)
b) minimum temperature with less than -1.5 degrees Celsius (with color dark blue)
c) the accumulate reached 40 degrees (with color red)
d) mean temperature over 10 degrees Celsius (with color yellow)

Clicking on a day displays all available data for that day in a side panel to the right.
