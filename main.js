import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { feature } from 'https://cdn.jsdelivr.net/npm/topojson-client@3/+esm';

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

const temperatureData = {
  California: 88,
  Texas: 92,
  Arizona: 97,
  Nevada: 95,
  Florida: 80,
  Washington: 58
};

const vegetationData = {
  California: 35,
  Texas: 45,
  Arizona: 15,
  Nevada: 10,
  Florida: 80,
  Washington: 88
};

const thermalData = {
  California: 90,
  Texas: 70,
  Arizona: 75,
  Nevada: 65,
  Florida: 35,
  Washington: 20
};

let currentLayer = "risk";
let selectedState = null;

function getColor(stateName) {

    let value;

    if (currentLayer === "risk") {
        value = riskScores[stateName] ?? 50;
    }
    else if (currentLayer === "temperature") {
        value = temperatureData[stateName] ?? 50;
    }
    else if (currentLayer === "vegetation") {
        value = vegetationData[stateName] ?? 50;
    }
    else {
        value = thermalData[stateName] ?? 50;
    }

    if (value > 80) return "#c1121f";
    if (value > 60) return "#f77f00";
    if (value > 40) return "#fcbf49";

    return "#6a994e";
}

const width = 960, height = 600;
const spotlightText = d3.select("#spotlight-text");

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
    .attr("fill", d => getColor(d.properties.name))
    .attr("stroke", "#fff")
    .on("mouseover", function (event, d) {
      const risk = riskScores[d.properties.name] ?? 50;
      const temp = temperatureData[d.properties.name] ?? 50;
      const veg = vegetationData[d.properties.name] ?? 50;
      const thermal = thermalData[d.properties.name] ?? 50;
      
      d3.select(this).attr("fill", "#128127");

      tooltip.style("display", "block")
             .style("left", `${event.pageX + 10}px`)
             .style("top", `${event.pageY + 10}px`)
             .html(`
               <strong>${d.properties.name}</strong><br>
               Risk Score: ${risk}<br>
               Temperature: ${temp}<br>
               Vegetation: ${veg}<br>
               Thermal Anomalies: ${thermal}
             `);
    })
    .on("click", function(event, d) {
      selectedState = d.properties.name;

      const risk = riskScores[selectedState] ?? 50;
      const temp = temperatureData[selectedState] ?? 50;
      const veg = vegetationData[selectedState] ?? 50;
      const thermal = thermalData[selectedState] ?? 50;

      spotlightText.html(`
          <strong>${selectedState}</strong><br>
          Risk Score: ${risk}<br>
          Temperature: ${temp}<br>
          Vegetation: ${veg}<br>
          Thermal Anomalies: ${thermal}
      `);
    })
    .on("mouseout", function(event, d) {
      d3.select(this).attr("fill", getColor(d.properties.name));

      tooltip.style("display", "none");
    });
});

const tooltip = d3.select("#tooltip");

d3.selectAll(".controls button")
  .on("click", function () {

    d3.selectAll(".controls button")
      .classed("active", false);

    d3.select(this)
      .classed("active", true);

    currentLayer = this.dataset.layer;

    svg.selectAll("path")
      .transition()
      .duration(400)
      .attr("fill", d => getColor(d.properties.name))
      .attr("stroke-width", d =>
        d.properties.name === selectedState ? 3 : 1
      );
      .attr("stroke", d =>
        d.properties.name === selectedState ? "#ffffff" : "#fff"
      );
});
