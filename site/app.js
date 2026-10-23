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

function latestPopup(p, city) {
  const verdict = p.avg_ecoli > city.safeLimit ? 'Not safe for swimming' : 'Safe for swimming';
  return '<strong>' + p.beach_name + '</strong><br>' +
    verdict + '<br>' +
    'Average E. coli: ' + p.avg_ecoli + ' per 100 mL<br>' +
    'Sampled ' + p.date + ' (' + p.n_readings + ' readings)';
}

function recentPopup(p, city) {
  const verdict = p.avg_ecoli > city.safeLimit ? 'Usually not safe for swimming' : 'Usually safe for swimming';
  return '<strong>' + p.beach_name + '</strong><br>' +
    verdict + '<br>' +
    'Average E. coli: ' + p.avg_ecoli + ' per 100 mL<br>' +
    'Averaged over the last ' + p.seasons_used + ' seasons';
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
function showSection(key, section) {
  const city = CITIES[key];
  if (key !== currentCity) { showCity(key); }

  const titles = {
    about: city.name + ' Beach Water Quality',
    trends: city.name + ' Historical Quality Trends'
  };
  document.getElementById('panel-title').textContent = titles[section];
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
const SECTIONS = [['about', 'About'], ['trends', 'Historical trends']];

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

