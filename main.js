import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { feature } from 'https://cdn.jsdelivr.net/npm/topojson-client@3/+esm';

const width = 960, height = 600;

const svg = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height);

const path = d3.geoPath();

d3.json("https://d3js.org/us-10m.v2.json").then(us => {
  svg.append("g")
      .attr("class", "states")
    .selectAll("path")
    .data(topojson.feature(us, us.objects.states).features)
    .enter().append("path")
      .attr("d", path)
      .attr("fill", "#ccc")
      .attr("stroke", "#fff");
});
