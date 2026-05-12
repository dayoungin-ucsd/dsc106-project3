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


function setYear(year) {
  d3.csv(`fire_data${year}.csv`).then(data => {
    const filtered = data.filter(d =>
      +d.type === 0 &&
      +d.confidence >= 80 &&
      +d.frp > 100
    );

    // clear old points first
    pointGroup.selectAll(".fire-point").remove();

    pointGroup.selectAll(".fire-point")
      .data(filtered)
      .join("circle")
      .attr("class", "fire-point")
      .attr("cx", d => { const pt = proj([+d.longitude, +d.latitude]); return pt ? pt[0] : null; })
      .attr("cy", d => { const pt = proj([+d.longitude, +d.latitude]); return pt ? pt[1] : null; })
      .attr("r", 2.5)
      .attr("fill", "rgba(255, 80, 0, 0.8)")
      .attr("stroke", "none")
      .attr("display", d => proj([+d.longitude, +d.latitude]) ? null : "none");
  });
}

// load default year on startup
setYear(2020);
