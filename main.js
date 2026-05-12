const W = 960, H = 620;
const ZOOM = 10;
const numTiles = Math.pow(2, ZOOM);
const tileW = W / numTiles;
const tileH = H / numTiles;
const z = ZOOM;

const layer = "MODIS_Terra_Thermal_Anomalies_Day";
const date  = "2022-08-20";

const svg = d3.select("#mapSVG").attr("viewBox", `0 0 ${W} ${H}`);

// mapGroup declared at the top level so everything shares it
const mapGroup    = svg.append("g").attr("id", "mapGroup");
const tileGroup   = mapGroup.append("g").attr("id", "tiles");
const borderGroup = mapGroup.append("g").attr("id", "borders");
const pointGroup  = mapGroup.append("g").attr("id", "points");



const proj = d3.geoAlbersUsa()
  .scale(1200)
  .translate([W / 2, H / 2]);


const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
function tileUrl(layer, date, z, row, col) {
  return `${GIBS}/${layer}/default/${date}/GoogleMapsCompatible_Level9/${z}/${row}/${col}.png`;
}





function tile3857ToLonLat(z, row, col) {
  const numTiles = Math.pow(2, z);
  const lon = (col / numTiles) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * row / numTiles)));
  const lat = latRad * 180 / Math.PI;
  return [lon, lat];
}




for (let row = 0; row < numTiles; row++) {
  for (let col = 0; col < numTiles; col++) {
    const [lon, lat] = tile3857ToLonLat(ZOOM, row, col);

    // skip tiles outside the US bounding box
    if (lon < -130 || lon > -60 || lat < 20 || lat > 55) continue;

    const pt = proj([lon, lat]);
    if (!pt) continue;
    const [px, py] = pt;

    tileGroup.append("image")
      .attr("href", tileUrl(layer, date, ZOOM, row, col))
      .attr("x", px).attr("y", py)
      .attr("width", tileW + 1).attr("height", tileH + 1)
      .attr("opacity", 0.85)
      .on("error", function() { d3.select(this).remove(); });
  }
}


d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json")
  .then(us => {
    const states = topojson.feature(us, us.objects.states);

    borderGroup.selectAll(".state")
      .data(states.features)
      .join("path")
      .attr("class", "state")
      .attr("d", d3.geoPath(proj))
      .attr("fill", "transparent")
      .attr("stroke", "rgba(255,255,255,0.45)")
      .attr("stroke-width", 0.6)
  });


const zoomBehavior = d3.zoom()
  .scaleExtent([1, 20])        // min zoom 1x, max 20x
  .on("zoom", function(event) {
    mapGroup.attr("transform", event.transform);
  });

svg.call(zoomBehavior);

let stateFeatures = [];

d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json").then(us => {
  stateFeatures = topojson.feature(us, us.objects.states).features;

  borderGroup.selectAll(".state")
    .data(stateFeatures)
    .join("path")
    .attr("class", "state")
    .attr("id", d => `state-${d.id}`)
    .attr("d", d3.geoPath(proj))
    .attr("fill", "transparent")
    .attr("stroke", "rgba(255,255,255,0.45)")
    .attr("stroke-width", 0.6);
});

  
  function setYear(year) {
    d3.json(`counts-${year}.json`).then(counts => {
    applyColors(counts);  
  });
}



function applyColors(counts){
  // color scale based on count
      const maxCount = d3.max(Object.values(counts));
      const colorScale = d3.scaleThreshold()
        .domain([10, 50, 200, 500, 2000])
        .range([
    "#feedde",   // 0–10       very low
    "#fdbe85",   // 10–50      low
    "#fd8d3c",   // 50–200     moderate
    "#e6550d",   // 200–500    high
    "#bd0026",   // 500–2000   very high
    "#7f0000",   // 2000+      extreme (CA, TX outliers)
      ]);

      // fill each state
      borderGroup.selectAll(".state")
        .attr("fill", d => colorScale(counts[d.id] || 0));

      renderLegend(maxCount);
}

function renderLegend(maxCount) {
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
    .attr("id", "legend")
    .attr("transform", `translate(${W - 240}, ${H - 150})`);

  // background
  legend.append("rect")
    .attr("x", -10).attr("y", -24)
    .attr("width", 200).attr("height", bins.length * 18 + 30)
    .attr("fill", "rgba(0,0,0,0.55)")
    .attr("rx", 6);

  // title
  legend.append("text")
    .attr("x", 90).attr("y", -8)
    .attr("text-anchor", "middle")
    .attr("font-size", 12).attr("font-weight", "600")
    .attr("fill", "#eee")
    .text("Thermal Anomaly Detections");

  // one row per bin
  bins.forEach((bin, i) => {
    const y = i * 18;

    legend.append("rect")
      .attr("x", 0).attr("y", y)
      .attr("width", 14).attr("height", 14)
      .attr("fill", bin.color)
      .attr("rx", 2);

    legend.append("text")
      .attr("x", 20).attr("y", y + 11)
      .attr("font-size", 11)
      .attr("fill", "#ccc")
      .text(bin.label);
  });
}

// load default year on startup
setYear(2020);
