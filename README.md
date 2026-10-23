# Public Beach Water Quality

This map shows the water quality of beaches in Toronto, which is otherwise only accessible from going to the beach itself.

**This map is for** distance swimmers and recreational users.

**What you can do here:** view the water quality data for different beaches in Toronto, and see historical trends in water quality since 2007.

## The five sentences

1. **Problem.** Someone at the beach in Toronto (or other city) might not have access to the most recent water quality data, this site shows the most updated data and the historical trends on all supervised beaches in Toronto.
2. **Audience.** A distance swimmer or recreational user.
3. **Core action.** Click on each beach to see if the last reading was unsafe. Also to show historical water quality trends at the beaches.
4. **Boundary.** The map does not pull live water quality and precipitation data yet, rather just the historical data.
5. **Data.** Open-source water quality readings from the City of Toronto as well as Government of Canada historical precipation data.

## How to run it

1. Open this folder in VS Code.
2. Run `notebooks/beach_quality.ipynb` top to bottom, make sure all test are passed.
3. Right-click `site/index.html` and open with live server

## The layers

| Layer | File | What it does |
| --- | --- | --- |
| Data | `data/Toronto Ecoli Data/torontowater.csv` | All E.Coli water quality data since 2007|
| Data | `data/Toronto Daily Weather` | All daily precipitation data since 2007 |
| Processing | `notebooks/beach-quality.ipynb` | Reads CSV, drops void values, keeps most recent, makes GEOJSON |
| Structure | `site/index.html` | Defines structure of site, map location, text centering, columns |
| Presentation | `site/style.css` | Defines colours and font |
| Behaviour | `site/app.js` | Loads data, defines site features |

## Pipeline

```
data/Toronto EColi Data/torontowater.csv  ->  notebooks/beach_quality.ipynb  ->  data/beaches.geojson  ->  site/app.js  ->  the map
```

The notebook drops every sample with no E. coli reading (counted in its output) and drops sampling sites whose coordinates are more than 1km from their beach's centre (also counted and printed — see Testing evidence below), before averaging each beach's remaining sites into one daily reading. A check cell then verifies the written GeoJSON has the expected feature count, stays within Toronto's bounding box, and has the expected properties, before the page ever loads it.

## Testing evidence

The outlier check in `beach_quality.ipynb` caught two mislabelled sampling sites — Sunnyside Beach site `60W` (15.6km from its beach's centre) and Gibraltar Point Beach site `GP6` (13.8km) — that would otherwise have pulled their beach's average toward a wrongly located point. Both were dropped before the beach averages were computed.

## Not in this iteration

- **A live, rainfall-based risk estimate.** The original pitch (see A1) was to estimate a beach's current risk from recent rainfall, ahead of the official lab result. That relationship is real — prototyped separately in `notebooks/precipitation_model.ipynb` (logistic regression on antecedent rainfall, test AUC 0.65) and checked against real events in `notebooks/beach_season_case_study.ipynb` — but it isn't wired into the live map yet. The Historical Trends panel on the page shows the same underlying analysis as static context in the meantime.
- **Other cities.** The site is structured to support more than one city (see the `CITIES` object in `site/app.js`), but no second city's data pipeline has been built. Sydney, Australia is the leading candidate, but it measures a different bacteria (enterococci, not E. coli) under a different grading standard, which needs to be resolved before its data can be added on the same terms as Toronto's.

## Data sources

- [Toronto Beaches Water Quality](https://open.toronto.ca/dataset/toronto-beaches-water-quality/), City of Toronto Open Data, Open Government Licence – Toronto, accessed 2026-09-23. E. coli sample results by beach and sampling site, 2007–2026.
- [Historical daily precipitation](https://climate.weather.gc.ca/historical_data/search_historic_data_e.html), Environment and Climate Change Canada, Open Government Licence – Canada, accessed 2026-10-07. Station: TORONTO CITY (Climate ID 6158355), 2007–2026.

# After the Demo

After the demo I had some ideas as to what to add to my map. Today I will add another layer to show the beaches seasonal average, and its distance to a nearest park. This second layer adds an option to users who find their beach to have unsafe water, they can go to a park. 

# 5 second answers

Partner saw that green was safe, and red was unsafe (colours made sense)


## AI disclosure

I used Claude Code whenever consulting an AI for the entirety of this project. I chose to use the "blue" lane when doing most of my prompts. I used a lot of the code from labs and folders that were handed out on moodle and asked claude to change data so that it corresponded with my project. Most of the time I got Claude to inform me where a change is to be made and why, so I can gain some insight as to how I can manipulate the code further without the help of the tool. I did go down the "black diamond" lane for the precipitation model notebook, as I did not directly implement the findings into the website. I wanted to see what was possible and if there were correlations between the data. I also used Claude to troubleshoot any weird results I would recive from the code. For example initally my points on the map were not exactly where the beach was. I asked it how it was reciving the coordinates, then found that there were a few outliers within the data (some coordinates we multiple kms apart, when they shouldve been just meters). Then we came up with a work around which was eventually implemented in the notebook. All the text on the site is mine, Claude helped me with the dirty work of understanding the coding languages. 