import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { feature } from 'https://cdn.jsdelivr.net/npm/topojson-client@3/+esm';

const width = 960, height = 600;

const score = riskScores[d.properties.name] ?? 50;
const riskScores = {
  California: 92,
  Texas: 85,
  Arizona: 96,
  Nevada: 90,
  Florida: 42,
  Washington: 18,
  Oregon: 24,
  Utah: 83,
  Colorado: 68,
  "New Mexico": 94
};

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
    .enter()
    .append("path")
    .attr("d", path)
    .attr("fill", d => {
        const score = riskScores[d.properties.name] ?? 50;
        if (score > 80) return "#c1121f";
        if (score > 60) return "#f77f00";
        if (score > 40) return "#fcbf49";
        return "#6a994e";
      })
    .attr("stroke", "#fff")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("fill", "#128127");

      tooltip.style("display", "block")
             .style("left", `${event.pageX + 10}px`)
             .style("top", `${event.pageY + 10}px`)
             .html(`
               <strong>${d.properties.name}</strong><br>
               Risk Score: ${score}<br>
               Temperature: High<br>
               Vegetation: Low<br>
               Thermal Anomalies: Elevated
             `);
    })
    .on("mouseout", function(event, d) {
      const score = riskScores[d.properties.name] ?? 50;
      
      d3.select(this).attr("fill", () => {
        if (score > 80) return "#c1121f";
        if (score > 60) return "#f77f00";
        if (score > 40) return "#fcbf49";
        return "#6a994e";
      });

      tooltip.style("display", "none");
    });
});

const tooltip = d3.select("#tooltip");
