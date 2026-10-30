// Builds a vertical bar chart from [label, pct] pairs, e.g.
// chart([['0mm', 13], ['0-5mm', 14], ...])
function chart(rows) {
  const maxPct = Math.max.apply(null, rows.map(function (r) { return r[1]; }));
  const bars = rows.map(function (r) {
    const height = (r[1] / maxPct) * 100;
    return '<div class="chart-col">' +
             '<span class="chart-value">' + r[1] + '%</span>' +
             '<div class="chart-bar" style="height:' + height + '%"></div>' +
             '<span class="chart-label">' + r[0] + '</span>' +
           '</div>';
  }).join('');
  return '<div class="chart">' + bars + '</div>';
}


// CITIES: one entry per city. To add a city, copy the toronto block,
// give it a new key, and change the values.
const CITIES = {
  toronto: {
    name: 'Toronto',
    center: [43.64, -79.39],
    zoom: 11,
    dataUrl: '../data/beaches.geojson',
    recentDataUrl: '../data/beaches_recent_avg.geojson',
    parksDataUrl: '../data/nearest_parks.geojson',
    seasonDataUrl: '../data/season_data.json',
    safeLimit: 100,   // E. coli per 100 mL
        about: `
      <p class="lede">This map shows the water quality of beaches in Toronto, which is otherwise only accessable from going to the beach itself.</p>
      <p><strong>This map is for</strong> Distance Swimmers and Recreational Users.</p>
      <p><strong>What you can do here:</strong> On this website, you can view the water quality data for different beaches in Toronto. You can also see historical trends in water quality since 2007</p>
      <section>
        <h2>Not in this iteration</h2>
        <p>Live rainfall-based risk estimates are not included in this version. I cut the ability to access live rainfall data and prioritized the display of historical trends. I plan to add this function eventually. 
        I also coded everything with the intention of adding other cities. Toronto has stopped collecting live water quality data, so what you see on the map is the most updated results. I plan to add other cities like Sydney, Australia to explore real-time
        data updates in the future.</p>
      </section>
      <section>
        <h2>Where this comes from</h2>
        <ul>
          <li><a href="https://open.toronto.ca/dataset/toronto-beaches-water-quality/">Toronto Beaches Water Quality</a>, City of Toronto Open Data, Open Government Licence – Toronto, accessed 2026-09-23. I removed void E.Coli values from the dataset and kept the most recent reading, then converted into a GEOJSON file.</li>
          <li><a href="https://climate.weather.gc.ca/historical_data/search_historic_data_e.html">Historical daily precipitation</a>, Environment and Climate Change Canada, Open Government Licence – Canada, accessed 2026-10-07. I compared the precipitation data with the water quality readings for each date. Then checked if there was any correlation between unsafe readings and precipitation amounts.</li>
        </ul>
      </section>`,
    trends: `
<p>Toronto's beaches are generally safe for swimming, but there are sometimes when the water quality is poor. Over years of data collection, there have been some historical trends
         in the water quality. For example, the water quality is generally worse after heavy rain, and the warmer months show higher levels of contamination.</p>
         <p><strong>More rain in the prior 3 days means more unsafe readings:</strong></p>
      ${chart([['0mm', 13], ['0-5mm', 14], ['5-15mm', 21], ['15-30mm', 29], ['30mm+', 44]])}
      <p><strong>Water quality also varies by month:</strong></p>
      ${chart([['May', 10], ['June', 17], ['July', 21], ['August', 19], ['September', 18]])}
      <p> These charts show the percentage of unsafe readings for each category. For example, 44% of readings were unsafe when there was more than 30mm of rain in the prior 3 days. The month of July had the highest percentage of unsafe readings at 21%.</p>
      <p class="source-note"><em>Source: City of Toronto beach water quality open data; Environment and Climate Change Canada daily precipitation (TORONTO CITY station), 2007-2026.</em></p>`
  }
  // , montreal: { name: 'Montréal', center: [...], zoom: 11, dataUrl: '...', safeLimit: ..., about: `...` }
};


// BEHAVIOUR: what happens on the page. Runs top to bottom when the page loads.
// Lab 3. Parts 6 to 8 of the handout ask you to change the lines marked PART.

// PART 7 will change this line. Leave it for now.
const map = L.map('map', { preferCanvas: true })

// Base map: OpenStreetMap. It needs the page served by Live Server, which is how
// this lab opens it. A page opened by double-click gets "Access blocked" tiles.
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Toronto's swimming limit: over 100 E. Coli per 100 mL is unsafe.


const colours = { safe: '#2ca02c', unsafe: '#d62728' };

let latestLayer = null;    // the "latest reading" markers
let recentLayer = null;    // the "recent seasons average" markers
let parksLayer = null;     // the nearby-parks markers + dotted lines (independent overlay)
let layersControl = null;  // the layer switcher (top right)
let currentCity = null;    // city which map is on now

// Builds one coloured-marker layer from GeoJSON, using the given function
// to write each marker's popup text.
function makeLayer(data, city, popupFn) {
  return L.geoJSON(data, {
    pointToLayer: function (feature, latlng) {
      const unsafe = feature.properties.avg_ecoli > city.safeLimit;
      return L.circleMarker(latlng, {
        radius: 8, stroke: true, color: '#000', weight: 1,
        fillColor: unsafe ? colours.unsafe : colours.safe, fillOpacity: 0.8
      });
    },
    onEachFeature: function (feature, layer) {
      layer.bindPopup(popupFn(feature.properties, city));
    }
  });
}

// What kind of shoreline a beach sits on explains a lot of its record, so it
// goes in every popup. Share of beach-days unsafe since 2007, per category.
const CATEGORY_RATE = {
  'River/creek mouth': 38,
  'Breakwall (enclosed)': 24,
  'Open mainland': 12,
  'Exposed island': 8
};

function categoryLine(p) {
  if (!p.category) { return ''; }
  const rate = CATEGORY_RATE[p.category];
  return '<br><em>' + p.category + '</em>' +
         (rate ? ' — ' + rate + '% of readings unsafe since 2007' : '');
}

function latestPopup(p, city) {
  const verdict = p.avg_ecoli > city.safeLimit ? 'Not safe for swimming' : 'Safe for swimming';
  return '<strong>' + p.beach_name + '</strong><br>' +
    verdict + '<br>' +
    'Average E. coli: ' + p.avg_ecoli + ' per 100 mL<br>' +
    'Sampled ' + p.date + ' (' + p.n_readings + ' readings)' +
    categoryLine(p);
}

function recentPopup(p, city) {
  const verdict = p.avg_ecoli > city.safeLimit ? 'Usually not safe for swimming' : 'Usually safe for swimming';
  return '<strong>' + p.beach_name + '</strong><br>' +
    verdict + '<br>' +
    'Average E. coli: ' + p.avg_ecoli + ' per 100 mL<br>' +
    'Averaged over the last ' + p.seasons_used + ' seasons' +
    categoryLine(p);
}

// A separate layer: the nearest park to each beach, for when swimming isn't
// advised. Styled differently (teal squares) so it reads as "a different kind
// of thing" from the red/green safety dots, not a third safety category.
function makeParksLayer(data) {
  return L.geoJSON(data, {
    pointToLayer: function (feature, latlng) {
      return L.circleMarker(latlng, {
        radius: 6, stroke: true, color: '#000', weight: 1,
        fillColor: '#1b998b', fillOpacity: 0.85
      });
    },
    onEachFeature: function (feature, layer) {
      const p = feature.properties;
      layer.bindPopup('<strong>' + p.park_name + '</strong><br>' +
        'Nearest to ' + p.nearest_to_beach + '<br>' +
        p.distance_km + ' km away');
    }
  });
}

// A dotted line from each beach to its nearest park. Built client-side from
// data already fetched -- beachData has each beach's own coordinates, parksData
// has each park's coordinates and which beach it belongs to (nearest_to_beach).
// No new data file needed, just matching the two up by beach name.
function makeParkLines(beachData, parksData) {
  const lines = parksData.features.map(function (parkFeature) {
    const beachFeature = beachData.features.find(function (f) {
      return f.properties.beach_name === parkFeature.properties.nearest_to_beach;
    });
    if (!beachFeature) { return null; }

    const beachLatLng = [beachFeature.geometry.coordinates[1], beachFeature.geometry.coordinates[0]];
    const parkLatLng = [parkFeature.geometry.coordinates[1], parkFeature.geometry.coordinates[0]];
    return L.polyline([beachLatLng, parkLatLng], {
      color: '#1b998b', weight: 2, opacity: 0.7, dashArray: '6, 6'
    });
  }).filter(Boolean);

  return L.layerGroup(lines);
}
// ---- Season summary -------------------------------------------------------
// The reader picks a year and a rainfall threshold; the page works out which
// days that year had that much rain, and what happened to the beaches after.
// The maths here mirrors beach_season_case_study.ipynb.
let seasonData = null;   // the JSON, cached after its first load

// Date arithmetic on "YYYY-MM-DD" strings. Parsed and stepped in UTC on
// purpose: doing it in local time shifts the date across the timezone offset.
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// How many days from one date to another. Needed because beaches aren't sampled
// every single day -- a reading's position in the list is not its day number.
function daysBetween(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

// Draws every event of a season on one set of axes, so they can be compared:
// days since the rain across the bottom, % of beaches unsafe up the side.
// Hand-built SVG -- no charting library.
function seasonPlot(events, baseline, daysAfter) {
  const W = 320, H = 212;
  const L = 34, R = 8, T = 10, B = 54;    // margins
  const pw = W - L - R, ph = H - T - B;   // plot area
  // Deliberately avoids the map's colours: red, green and teal already mean
  // "unsafe", "safe" and "nearby park" in the legend beside this chart.
  const palette = ['#1f77b4', '#ff7f0e', '#7b4397', '#8c564b', '#555555'];

  const x = function (day) { return L + (day / daysAfter) * pw; };
  // SVG's y axis grows downward, so a HIGH percentage maps to a SMALL y
  const y = function (pct) { return T + ph - (pct / 100) * ph; };

  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' +
            'Percentage of beaches unsafe in the days following each heavy rain day">';

  // horizontal gridlines, fixed 0-100% so the axis never silently rescales
  [0, 25, 50, 75, 100].forEach(function (p) {
    svg += '<line x1="' + L + '" y1="' + y(p) + '" x2="' + (L + pw) + '" y2="' + y(p) +
           '" stroke="#e5e7ef" stroke-width="1"/>' +
           '<text x="' + (L - 5) + '" y="' + (y(p) + 3) + '" font-size="9" fill="#666" ' +
           'text-anchor="end">' + p + '%</text>';
  });

  for (let d = 0; d <= daysAfter; d++) {
    svg += '<text x="' + x(d) + '" y="' + (T + ph + 13) + '" font-size="9" fill="#666" ' +
           'text-anchor="middle">' + d + '</text>';
  }
  svg += '<text x="' + (L + pw / 2) + '" y="' + (T + ph + 26) + '" font-size="9" fill="#555" ' +
         'text-anchor="middle">days since the heavy rain</text>';

  svg += '<line x1="' + L + '" y1="' + y(baseline) + '" x2="' + (L + pw) + '" y2="' + y(baseline) +
         '" stroke="#888" stroke-width="1" stroke-dasharray="4,3"/>';

  // one line per event; shape alternates as well as colour, so the series are
  // still tellable apart without relying on colour
  events.forEach(function (ev, i) {
    const c = palette[i % palette.length];
    svg += '<polyline points="' + ev.days.map(function (d) { return x(d[0]) + ',' + y(d[1]); }).join(' ') +
           '" fill="none" stroke="' + c + '" stroke-width="2"/>';
    ev.days.forEach(function (d) {
      svg += (i % 2 === 0)
        ? '<circle cx="' + x(d[0]) + '" cy="' + y(d[1]) + '" r="3.5" fill="' + c + '"/>'
        : '<rect x="' + (x(d[0]) - 3) + '" y="' + (y(d[1]) - 3) + '" width="6" height="6" fill="' + c + '"/>';
    });
  });

  let lx = L;
  const ly = H - 12;
  events.forEach(function (ev, i) {
    const c = palette[i % palette.length];
    svg += (i % 2 === 0)
      ? '<circle cx="' + (lx + 4) + '" cy="' + (ly - 3) + '" r="3.5" fill="' + c + '"/>'
      : '<rect x="' + (lx + 1) + '" y="' + (ly - 6) + '" width="6" height="6" fill="' + c + '"/>';
    svg += '<text x="' + (lx + 12) + '" y="' + ly + '" font-size="9" fill="#333">' + ev.date.slice(5) + '</text>';
    lx += 54;
  });
  svg += '<line x1="' + lx + '" y1="' + (ly - 3) + '" x2="' + (lx + 10) + '" y2="' + (ly - 3) +
         '" stroke="#888" stroke-width="1" stroke-dasharray="3,2"/>' +
         '<text x="' + (lx + 14) + '" y="' + ly + '" font-size="9" fill="#333">baseline</text>';

  return svg + '</svg>';
}

function summariseSeason(data, year, thresh) {
  const yearStr = String(year);

  // Is there a season for that year at all?
  const inYear = data.beach_days.filter(function (r) { return r[0].slice(0, 4) === yearStr; });
  if (inYear.length === 0) {
    const all = data.beach_days;
    return { error: 'No beach data for ' + year + '. Pick a year between ' +
                    all[0][0].slice(0, 4) + ' and ' + all[all.length - 1][0].slice(0, 4) + '.' };
  }

  // Is the threshold a number that can tell you anything?
  let maxRain = 0;
  data.rain.forEach(function (r) { if (r[1] > maxRain) { maxRain = r[1]; } });
  if (!(thresh > 0)) {
    return { warning: 'A threshold of ' + thresh + 'mm counts every day as heavy rain, ' +
                      'so the result would say nothing. Try a number above 0.' };
  }
  if (thresh > maxRain) {
    return { warning: 'No day since 2007 saw ' + thresh + 'mm of rain — the wettest was ' +
                      maxRain + 'mm. Try a lower threshold.' };
  }

  // The season's own span, and how often beaches were unsafe across all of it
  const seasonStart = inYear[0][0];
  const seasonEnd = inYear[inYear.length - 1][0];
  let sampled = 0, unsafe = 0;
  inYear.forEach(function (r) { sampled += r[1]; unsafe += r[2]; });
  const baseline = Math.round((unsafe / sampled) * 100);

  // Heavy rain days inside the sampling season, and the days that followed
  const events = [];
  data.rain.forEach(function (r) {
    if (r[0].slice(0, 4) !== yearStr || r[1] < thresh) { return; }
    if (r[0] < seasonStart || r[0] > seasonEnd) { return; }  // no beach data to compare against
    const windowEnd = addDays(r[0], data.days_after);
    const days = inYear
      .filter(function (b) { return b[0] >= r[0] && b[0] <= windowEnd; })
      .map(function (b) { return [daysBetween(r[0], b[0]), Math.round((b[2] / b[1]) * 100)]; });
    events.push({ date: r[0], mm: r[1], days: days });
  });

  return { seasonStart: seasonStart, seasonEnd: seasonEnd, baseline: baseline,
           events: events, daysAfter: data.days_after };
}

function renderSeason(result, year, thresh) {
  if (result.error) {
    return '<p style="color:#b3261e"><strong>' + result.error + '</strong></p>';
  }
  if (result.warning) {
    return '<p style="color:#8a6d00"><strong>That won\'t tell you much.</strong> ' + result.warning + '</p>';
  }

  let html = '<p>The ' + year + ' season ran ' + result.seasonStart + ' to ' + result.seasonEnd +
             '. Across the whole season, <strong>' + result.baseline + '%</strong> of readings were unsafe.</p>';

  if (result.events.length === 0) {
    return html + '<p>No day in that season had ' + thresh + 'mm of rain or more, so there is nothing ' +
                  'to compare. Try a lower threshold.</p>';
  }

  html += '<p>' + result.events.length + ' day(s) reached ' + thresh + 'mm or more. Each line below ' +
          'follows one of them through the days that came after:</p>' +
          seasonPlot(result.events, result.baseline, result.daysAfter) +
          '<ul>';
  result.events.forEach(function (ev) {
    html += '<li><strong>' + ev.date + '</strong> — ' + ev.mm + 'mm of rain</li>';
  });
  return html + '</ul><p class="source-note"><em>The dashed line is the season baseline of ' +
                result.baseline + '%. Points above it mean water quality was worse than usual.</em></p>';
}

function showSeason(key) {
  const panel = document.getElementById('panel-text');

  function run() {
    const year = parseInt(document.getElementById('season-year').value, 10);
    const thresh = parseFloat(document.getElementById('season-mm').value);
    document.getElementById('season-out').innerHTML = renderSeason(
      summariseSeason(seasonData, year, thresh), year, thresh);
  }

  function build() {
    panel.innerHTML =
      '<p>Pick a season and a rainfall threshold to see how water quality reacted after heavy rain.</p>' +
      '<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px">' +
        '<label>Year<br><input id="season-year" type="number" value="2021" style="width:85px"></label>' +
        '<label>Heavy rain (mm)<br><input id="season-mm" type="number" value="25" style="width:85px"></label>' +
        '<button id="season-go" type="button">Show</button>' +
      '</div><div id="season-out"></div>';
    document.getElementById('season-go').addEventListener('click', run);
    run();
  }

  if (seasonData) { build(); return; }

  panel.innerHTML = '<p>Loading season data ...</p>';
  fetch(CITIES[key].seasonDataUrl)
    .then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status + ' loading ' + CITIES[key].seasonDataUrl); }
      return r.json();
    })
    .then(function (d) { seasonData = d; build(); })
    .catch(function (err) {
      panel.innerHTML = '<p>Could not load the season data. Open the console (F12) for details.</p>';
      console.error(err);
    });
}

function showSection(key, section) {
  const city = CITIES[key];
  if (key !== currentCity) { showCity(key); }

  const titles = {
    about: city.name + ' Beach Water Quality',
    trends: city.name + ' Historical Quality Trends',
    season: city.name + ' Season Summary'
  };
  document.getElementById('panel-title').textContent = titles[section];
  if (section === 'season') { showSeason(key); return; }   // builds its own content
  document.getElementById('panel-text').innerHTML = city[section];
}
function showCity(key) {
  const city = CITIES[key];

  // Highlight the active button
  document.querySelectorAll('#city-bar [data-city]').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.city === key);
  });
  currentCity = key;
  // Update the About panel and move the map

  document.getElementById('status').textContent = 'Loading data ...';
  map.setView(city.center, city.zoom);

  // Remove the previous city's layers and layer switcher
  if (latestLayer) { map.removeLayer(latestLayer); }
  if (recentLayer) { map.removeLayer(recentLayer); }
  if (parksLayer) { map.removeLayer(parksLayer); }
  if (layersControl) { map.removeControl(layersControl); }

  function loadJSON(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) { throw new Error('HTTP ' + response.status + ' loading ' + url); }
      return response.json();
    });
  }

  Promise.all([loadJSON(city.dataUrl), loadJSON(city.recentDataUrl), loadJSON(city.parksDataUrl)])
    .then(function (results) {
      const latestData = results[0];
      const recentData = results[1];
      const parksData = results[2];

      latestLayer = makeLayer(latestData, city, latestPopup).addTo(map);
      recentLayer = makeLayer(recentData, city, recentPopup);
      parksLayer = L.layerGroup([
        makeParkLines(latestData, parksData),   // drawn first, so dots sit on top
        makeParksLayer(parksData)
      ]);

      // "Latest reading" / "3-season average" are passed as the first argument
      // (base layers) so Leaflet treats them as mutually exclusive -- they're
      // the same points, so showing both at once would just stack two sets of
      // markers on top of each other. "Nearby parks" goes in the second
      // argument (an overlay) because it sits at different locations and is
      // meant to be viewed alongside whichever beach layer is active.
      layersControl = L.control.layers(
        { 'Latest reading': latestLayer, '3-season average': recentLayer },
        { 'Nearby parks': parksLayer }
      ).addTo(map);

      document.getElementById('status').textContent =
        'Showing ' + latestData.features.length + ' beaches in ' + city.name + '.';
    })
    .catch(function (err) {
      document.getElementById('status').textContent =
        'Could not load ' + city.name + ' data. Open the console (F12) for details.';
      console.error(err);
    });
}

// Close every open dropdown
function closeMenus() {
  document.querySelectorAll('.city-menu.open').forEach(function (m) {
    m.classList.remove('open');
  });
}

// The items in each city's dropdown: [section key, label shown]
const SECTIONS = [['about', 'About'], ['trends', 'Historical trends'], ['season', 'Season summary']];

const bar = document.getElementById('city-bar');
Object.keys(CITIES).forEach(function (key) {
  const wrap = document.createElement('div');
  wrap.className = 'city-menu';

  // The city button: opens or closes its dropdown
  const btn = document.createElement('button');
  btn.textContent = CITIES[key].name + ' ▾';
  btn.dataset.city = key;
  btn.addEventListener('click', function (e) {
    e.stopPropagation();                 // don't let the page-click below close it immediately
    const wasOpen = wrap.classList.contains('open');
    closeMenus();
    if (!wasOpen) { wrap.classList.add('open'); }
  });

  // The dropdown list
  const list = document.createElement('div');
  list.className = 'dropdown';
  SECTIONS.forEach(function (s) {
    const item = document.createElement('button');
    item.textContent = s[1];
    item.addEventListener('click', function () { showSection(key, s[0]); });
    list.appendChild(item);
  });

  wrap.appendChild(btn);
  wrap.appendChild(list);
  bar.appendChild(wrap);
});

// Clicking anywhere else on the page closes the dropdowns
document.addEventListener('click', closeMenus);

showSection('toronto', 'about');

