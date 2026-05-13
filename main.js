const W = 960, H = 620;

const svg = d3.select("#mapSVG")
  .attr("viewBox", `0 0 ${W} ${H}`)
  .style("width", "100%")
  .style("height", "620px");

const mapGroup    = svg.append("g").attr("id", "mapGroup");
const tileGroup   = mapGroup.append("g").attr("id", "tiles");
const borderGroup = mapGroup.append("g").attr("id", "borders");
const pointGroup  = mapGroup.append("g").attr("id", "points");

let baseline2020  = null;
let currentCounts = null;
let currentLayer  = "MODIS_Terra_Thermal_Anomalies_Day";
let currentYear   = "2020";
let lstData       = {};   // { "06": 22.5 }  °C, keyed by zero-padded FIPS
let ndviData      = {};   // { "06": 0.31 }  0–1, keyed by zero-padded FIPS

const layerConfigs = { "MODIS_Terra_Thermal_Anomalies_Day": 7 };
const proj = d3.geoAlbersUsa().scale(1200).translate([W / 2, H / 2]);
const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

// ─── Tile drawing ─────────────────────────────────────────────────────────────
function tile3857ToLonLat(z, row, col) {
  const n   = Math.pow(2, z);
  const lon = (col / n) * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * row / n))) * 180 / Math.PI;
  return [lon, lat];
}

function drawTiles(layerName, year) {
  tileGroup.selectAll("image").remove();
  const zoom    = layerConfigs[layerName];
  const n       = Math.pow(2, zoom);
  const dateStr = `${year}-08-15`; // Snapshot date for the NASA background tiles

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const [lon, lat]   = tile3857ToLonLat(zoom, row, col);
      const [lonR, latB] = tile3857ToLonLat(zoom, row + 1, col + 1);
      
      if (lon < -135 || lon > -60 || lat < 20 || lat > 55) continue;
      
      const p1 = proj([lon, lat]);
      const p2 = proj([lonR, latB]);
      
      if (!p1 || !p2) continue;
      
      tileGroup.append("image")
        .attr("href", `${GIBS}/${layerName}/default/${dateStr}/GoogleMapsCompatible_Level${zoom}/${zoom}/${row}/${col}.png`)
        .attr("x", p1[0]).attr("y", p1[1])
        .attr("width",  Math.abs(p2[0] - p1[0]) + 1)
        .attr("height", Math.abs(p2[1] - p1[1]) + 1)
        .attr("opacity", 0.80)
        .on("error", function() { d3.select(this).remove(); });
    }
  }
}

window.setLayer = function(newLayer) {
  currentLayer = newLayer;
  drawTiles(currentLayer, currentYear);
};

// ─── Zoom ─────────────────────────────────────────────────────────────────────
svg.call(
  d3.zoom().scaleExtent([1, 20])
    .on("zoom", e => mapGroup.attr("transform", e.transform))
);

// ─── Load TopoJSON (once) ─────────────────────────────────────────────────────
d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json").then(us => {
  const stateFeatures = topojson.feature(us, us.objects.states).features;
  borderGroup.selectAll(".state")
    .data(stateFeatures)
    .join("path")
    .attr("class",        "state")
    .attr("id",           d => `state-${d.id}`)
    .attr("d",            d3.geoPath(proj))
    .attr("fill",         "transparent")
    .attr("stroke",       "rgba(255,255,255,0.45)")
    .attr("stroke-width", 0.6);
});

// ─── Year selector & Data Loading ─────────────────────────────────────────────
window.setYear = function(year) {
  currentYear = year;
  lstData  = {};   
  ndviData = {};

  drawTiles(currentLayer, year);

  // Fetch both the anomaly counts and the pre-processed MODIS averages concurrently
  Promise.all([
    d3.json(`counts-${year}.json`),
    d3.json(`modis_data_${year}.json`)
  ]).then(([counts, modisData]) => {
    currentCounts = counts;

    // Map the new JSON structure into our global tooltip variables
    for (const fips in modisData) {
        lstData[fips] = modisData[fips].avg_lst_celsius;
        ndviData[fips] = modisData[fips].avg_ndvi;
    }

    if (!baseline2020) {
      d3.json("counts-2020.json").then(base => {
        baseline2020 = base;
        applyColors(counts);
        addStateInteraction(counts);
      });
    } else {
      applyColors(counts);
      addStateInteraction(counts);
    }
  }).catch(error => {
      console.error(`Error loading data for year ${year}:`, error);
  });
};

// ─── Choropleth coloring ──────────────────────────────────────────────────────
function applyColors(counts) {
  const colorScale = d3.scaleThreshold()
    .domain([10, 50, 200, 500, 2000])
    .range(["#feedde","#fdbe85","#fd8d3c","#e6550d","#bd0026","#7f0000"]);

  borderGroup.selectAll(".state")
    .attr("fill",         d => colorScale(counts[d.id] || 0))
    .attr("fill-opacity", 0.42);

  renderLegend();
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function renderLegend() {
  d3.select("#legend").remove();
  const bins = [
    { label: "0–10",     color: "#feedde" },
    { label: "10–50",    color: "#fdbe85" },
    { label: "50–200",   color: "#fd8d3c" },
    { label: "200–500",  color: "#e6550d" },
    { label: "500–2000", color: "#bd0026" },
    { label: "2000+",    color: "#7f0000" },
  ];

  const legend = svg.append("g")
    .attr("id",        "legend")
    .attr("transform", `translate(${W - 240}, ${H - 165})`);

  legend.append("rect")
    .attr("x", -10).attr("y", -28)
    .attr("width", 210).attr("height", bins.length * 20 + 38)
    .attr("fill", "rgba(0,0,0,0.60)").attr("rx", 7);

  legend.append("text")
    .attr("x", 95).attr("y", -10)
    .attr("text-anchor", "middle")
    .attr("font-size", 11).attr("font-weight", "600")
    .attr("fill", "#eee").attr("letter-spacing", "0.5px")
    .text("Thermal Anomaly Detections");

  bins.forEach((bin, i) => {
    const y = i * 20;
    legend.append("rect")
      .attr("x", 0).attr("y", y)
      .attr("width", 14).attr("height", 14)
      .attr("fill", bin.color).attr("rx", 2);
    legend.append("text")
      .attr("x", 22).attr("y", y + 11)
      .attr("font-size", 11).attr("fill", "#ccc")
      .text(bin.label);
  });
}

// ─── State name lookup ────────────────────────────────────────────────────────
const STATE_NAMES = {
  "01":"Alabama","02":"Alaska","04":"Arizona","05":"Arkansas","06":"California",
  "08":"Colorado","09":"Connecticut","10":"Delaware","11":"District of Columbia",
  "12":"Florida","13":"Georgia","15":"Hawaii","16":"Idaho","17":"Illinois",
  "18":"Indiana","19":"Iowa","20":"Kansas","21":"Kentucky","22":"Louisiana",
  "23":"Maine","24":"Maryland","25":"Massachusetts","26":"Michigan","27":"Minnesota",
  "28":"Mississippi","29":"Missouri","30":"Montana","31":"Nebraska","32":"Nevada",
  "33":"New Hampshire","34":"New Jersey","35":"New Mexico","36":"New York",
  "37":"North Carolina","38":"North Dakota","39":"Ohio","40":"Oklahoma","41":"Oregon",
  "42":"Pennsylvania","44":"Rhode Island","45":"South Carolina","46":"South Dakota",
  "47":"Tennessee","48":"Texas","49":"Utah","50":"Vermont","51":"Virginia",
  "53":"Washington","54":"West Virginia","55":"Wisconsin","56":"Wyoming"
};

// ─── Display helpers ──────────────────────────────────────────────────────────
function ndviDisplay(v) {
  if (v == null) return { text: "Data Unavailable", color: "#555" };
  let label = "Very arid";
  let color  = "#ff6b35";
  if      (v >= 0.60) { label = "Dense vegetation";    color = "#69db7c"; }
  else if (v >= 0.45) { label = "Moderate vegetation"; color = "#a9e34b"; }
  else if (v >= 0.30) { label = "Sparse vegetation";   color = "#ffe066"; }
  else if (v >= 0.10) { label = "Arid / barren";       color = "#ff9f43"; }
  return { text: `${v.toFixed(3)} — ${label}`, color };
}

function lstDisplay(v) {
  if (v == null) return { text: "Data Unavailable", color: "#555" };
  let color = "#70a1ff";
  if      (v >= 35) color = "#ff2f00";
  else if (v >= 28) color = "#ff4757";
  else if (v >= 22) color = "#ff6b35";
  else if (v >= 15) color = "#ffa502";
  else if (v >= 8)  color = "#eccc68";
  return { text: `${v.toFixed(1)} °C`, color };
}

// ─── Tooltip positioning ──────────────────────────────────────────────────────
function tooltipPos(event) {
  const ttW = 250, ttH = 250;
  const vw  = window.innerWidth, vh = window.innerHeight;
  let left  = event.clientX + 16;
  let top   = event.clientY - 10;
  if (left + ttW > vw - 10) left = event.clientX - ttW - 10;
  if (top  + ttH > vh - 10) top  = event.clientY - ttH - 10;
  return { left: left + "px", top: top + "px" };
}

// ─── State hover interaction ──────────────────────────────────────────────────
function addStateInteraction(counts) {
  const tooltip = document.getElementById("tooltip");

  borderGroup.selectAll(".state")
    .on("mouseenter", function(event, d) {
      d3.select(this)
        .attr("stroke",       "rgba(255,255,255,0.95)")
        .attr("stroke-width", 1.5);

      const fips  = String(d.id).padStart(2, "0");
      const name  = STATE_NAMES[fips] || "Unknown";
      const count = counts[d.id] || 0;
      const base  = baseline2020 ? (baseline2020[d.id] || 0) : null;
      const lst   = lstData[fips]  ?? null;
      const ndvi  = ndviData[fips] ?? null;

      let changeHtml = "";
      if (baseline2020) {
        if (base === 0 && count === 0) {
          changeHtml = `<div class="tt-row" style="color:#555;">No detections in 2020 or selected year</div>`;
        } else if (base === 0) {
          changeHtml = `<div class="tt-row" style="color:#ff6b6b;">⚑ New activity (no 2020 baseline)</div>`;
        } else {
          const pct   = ((count - base) / base * 100).toFixed(1);
          const color = +pct > 0 ? "#ff6b6b" : "#69db7c";
          const arrow = +pct > 0 ? "▲" : "▼";
          changeHtml  = `<div class="tt-row" style="color:${color};">${arrow} ${Math.abs(pct)}% vs 2020 baseline</div>`;
        }
      }

      const lstInfo  = lstDisplay(lst);
      const ndviInfo = ndviDisplay(ndvi);

      tooltip.style.display = "block";
      tooltip.innerHTML = `
        <div class="tt-title">${name}</div>
        <div class="tt-divider"></div>

        <div class="tt-section-label">Thermal Anomaly Detections</div>
        <div class="tt-row">
          <span class="tt-value">${count.toLocaleString()}</span> detections
        </div>
        <div class="tt-row tt-muted">
          2020 baseline: <strong>${base !== null ? base.toLocaleString() : "—"}</strong>
        </div>
        ${changeHtml}

        <div class="tt-divider"></div>
        <div class="tt-section-label">Land Surface Temp · Annual Avg <span style="color:#444;">(MODIS MOD11A2)</span></div>
        <div class="tt-row" style="color:${lstInfo.color};">● ${lstInfo.text}</div>

        <div class="tt-divider"></div>
        <div class="tt-section-label">Vegetation Index · Annual Avg <span style="color:#444;">(MODIS MOD13Q1)</span></div>
        <div class="tt-row" style="color:${ndviInfo.color};">● ${ndviInfo.text}</div>
      `;

      const pos = tooltipPos(event);
      tooltip.style.left = pos.left;
      tooltip.style.top  = pos.top;
    })
    .on("mousemove", function(event) {
      const pos = tooltipPos(event);
      tooltip.style.left = pos.left;
      tooltip.style.top  = pos.top;
    })
    .on("mouseleave", function() {
      d3.select(this)
        .attr("stroke",       "rgba(255,255,255,0.45)")
        .attr("stroke-width", 0.6);
      tooltip.style.display = "none";
    });

  svg.on("click", function(event) {
    if (event.target.classList.contains("state")) return;
    tooltip.style.display = "none";
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
drawTiles(currentLayer, "2020");
setYear("2020");