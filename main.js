import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { feature } from 'https://cdn.jsdelivr.net/npm/topojson-client@3/+esm';

const width = 960, height = 600;

const svg = d3.select("#vis").append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`);

const path = d3.geoPath();

d3.json("https://d3js.org/us-10m.v2.json").then(us => {
  svg.append("g")
    .attr("class", "states")
    .selectAll("path")
    .data(feature(us, us.objects.states).features)
    .enter().append("path")
    .attr("d", path)
    .attr("fill", "#ccc")
    .attr("stroke", "#fff")
    .on("mouseover", function () {
        d3.select(this)
          .attr("fill", "#128127");

        tooltip.style("display", "block")
               .style("left", `${event.pageX + 10}px`)
               .style("top", `${event.pageY + 10}px`)
               .html(`
                   <strong>${d.properties.name}</strong><br>
                   Risk Score: 72
                `);
    })
    .on("mouseout", function() {
        d3.select(this)
          .attr("fill", "#ccc");

        tooltip.style("display", "none");
    });
});

const tooltip = d3.select("#tooltip");
