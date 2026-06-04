var d3;

window.onload = () => {
  fetch('data/football.json')
    .then((response) => response.json())
    .then((json) => {
      const data = json.nodes;
      drawPCP(data);
      drawSPLOM(data);  
    });
};

function drawPCP(data) {
  const attributes = [
    "appearance", "mins_played", "ball_recovery", "possession",
    "pass_accurate", "pass_inaccurate", "final_third", "touches"
  ];

  const dims = attributes.filter(attr =>
    data.some(d => d[attr] !== undefined && !isNaN(+d[attr]))
  );

  const margin = { top: 40, right: 30, bottom: 10, left: 60 };
  const width = document.getElementById("pcp").clientWidth - margin.left - margin.right;
  const height = 420 - margin.top - margin.bottom;

  const svg = d3.select("#pcp")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scalePoint()
    .domain(dims)
    .range([0, width])
    .padding(0.3);

  const y = {};
  dims.forEach(dim => {
    y[dim] = d3.scaleLinear()
      .domain(d3.extent(data, d => +d[dim] || 0))
      .range([height, 0])
      .nice();
  });

  const color = d3.scaleSequential(
    d3.extent(data, d => +d["appearance"] || 0),
    t => d3.interpolateBrBG(1 - t)
  );

  function linePath(d) {
    return d3.line()(dims.map(dim => [x(dim), y[dim](+d[dim] || 0)]));
  }

  const deselectedColor = "#ddd";

  const path = svg.append("g")
    .attr("fill", "none")
    .attr("stroke-width", 1.5)
    .attr("stroke-opacity", 0.4)
    .selectAll("path")
    .data(data)
    .join("path")
    .attr("class", "pcp-line")
    .attr("stroke", d => color(+d["appearance"] || 0))
    .attr("d", linePath);

  // Axes
  const axes = svg.selectAll(".axis")
    .data(dims)
    .join("g")
    .attr("class", "axis")
    .attr("transform", d => `translate(${x(d)},0)`);

  axes.each(function(dim) {
    d3.select(this).call(d3.axisLeft(y[dim]).ticks(5));
  });

  axes.append("text")
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .attr("fill", "#333")
    .text(d => d);

  // Brushing — using Map like the example
  const selections = new Map();
  const brushWidth = 20;

  const brush = d3.brushY()
    .extent([[-brushWidth / 2, 0], [brushWidth / 2, height]])
    .on("start brush end", function(event, dim) {
      if (event.selection === null) {
        selections.delete(dim);
      } else {
        selections.set(dim, event.selection.map(v => y[dim].invert(v)));
      }

      const selected = [];
      path.each(function(d) {
        const active = Array.from(selections).every(([key, [min, max]]) => {
          const val = +d[key] || 0;
          return val >= Math.min(min, max) && val <= Math.max(min, max);
        });
        d3.select(this).style("stroke", active ? color(+d["appearance"] || 0) : deselectedColor);
        if (active) selected.push(d);
      });

      const selectedNames = new Set(
        selections.size === 0 ? data.map(d => d.label) : selected.map(d => d.label)
      );

      window.dispatchEvent(new CustomEvent('selectionChanged', {
        detail: { selectedNames }
      }));
    });

  axes.append("g")
    .attr("class", "brush-group")
    .call(brush);
}

function drawSPLOM(data) {
  const columns = ["appearance", "mins_played", "ball_recovery", "possession", "pass_accurate"];
  
  const width = 700;
  const padding = 28;
  const size = (width - (columns.length + 1) * padding) / columns.length + padding;

  // X scales
  const x = columns.map(c => d3.scaleLinear()
    .domain(d3.extent(data, d => +d[c] || 0))
    .rangeRound([padding / 2, size - padding / 2]));

  // Y scales — INVERTED compared to original (this gives [/] diagonal)
  const y = columns.map((c, i) => d3.scaleLinear()
    .domain(d3.extent(data, d => +d[c] || 0))
    .rangeRound([padding / 2, size - padding / 2]));  // same direction as x = inverted diagonal

  const color = d3.scaleOrdinal()
    .domain(data.map(d => d.label))
    .range(d3.schemeTableau10);

  const svg = d3.select("#splom")
    .append("svg")
    .attr("width", width)
    .attr("height", width)
    .attr("viewBox", `${-padding} 0 ${width} ${width}`);

  // X axis
  const axisx = d3.axisBottom().ticks(4).tickSize(size * columns.length);
  const xAxis = g => g.selectAll("g").data(x).join("g")
    .attr("transform", (d, i) => `translate(${i * size},0)`)
    .each(function(d) { d3.select(this).call(axisx.scale(d)); })
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line").attr("stroke", "#ddd"));

  // Y axis
  const axisy = d3.axisLeft().ticks(4).tickSize(-size * columns.length);
  const yAxis = g => g.selectAll("g").data(y).join("g")
    .attr("transform", (d, i) => `translate(0,${i * size})`)
    .each(function(d) { d3.select(this).call(axisy.scale(d)); })
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line").attr("stroke", "#ddd"));

  svg.append("style").text(`circle.hidden { fill: #ddd; fill-opacity: 0.3; r: 2px; }`);
  svg.append("g").call(xAxis);
  svg.append("g").call(yAxis);

  const cell = svg.append("g")
    .selectAll("g")
    .data(d3.cross(d3.range(columns.length), d3.range(columns.length)))
    .join("g")
    .attr("transform", ([i, j]) => `translate(${i * size},${j * size})`);

  cell.append("rect")
    .attr("fill", "none")
    .attr("stroke", "#aaa")
    .attr("x", padding / 2 + 0.5)
    .attr("y", padding / 2 + 0.5)
    .attr("width", size - padding)
    .attr("height", size - padding);

  // Draw dots or diagonal
  cell.each(function([i, j]) {
    if (i === j) {
      // Diagonal label
      d3.select(this).append("text")
        .attr("x", size / 2)
        .attr("y", size / 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", "11px")
        .attr("font-weight", "bold")
        .text(columns[i]);

      // Inverted diagonal line [/]
      d3.select(this).append("line")
        .attr("x1", size - padding / 2).attr("y1", padding / 2)
        .attr("x2", padding / 2).attr("y2", size - padding / 2)
        .attr("stroke", "steelblue")
        .attr("stroke-width", 2);
    } else {
      d3.select(this).selectAll("circle")
        .data(data.filter(d => !isNaN(+d[columns[i]]) && !isNaN(+d[columns[j]])))
        .join("circle")
        .attr("cx", d => x[i](+d[columns[i]] || 0))
        .attr("cy", d => y[j](+d[columns[j]] || 0))
        .attr("data-label", d => d.label);
    }
  });

  const circle = cell.selectAll("circle")
    .attr("r", 3.5)
    .attr("fill-opacity", 0.7)
    .attr("fill", "steelblue");

  // SPLOM brush
  let brushCell;
  const splomBrush = d3.brush()
    .extent([[padding / 2, padding / 2], [size - padding / 2, size - padding / 2]])
    .on("start", function() {
      if (brushCell !== this) {
        d3.select(brushCell).call(splomBrush.move, null);
        brushCell = this;
      }
    })
    .on("brush", function(event, [i, j]) {
      if (!event.selection) return;
      const [[x0, y0], [x1, y1]] = event.selection;
      circle.classed("hidden", d =>
        x0 > x[i](+d[columns[i]] || 0) ||
        x1 < x[i](+d[columns[i]] || 0) ||
        y0 > y[j](+d[columns[j]] || 0) ||
        y1 < y[j](+d[columns[j]] || 0)
      );
      const selected = new Set(
        data.filter(d =>
          x0 < x[i](+d[columns[i]] || 0) &&
          x1 > x[i](+d[columns[i]] || 0) &&
          y0 < y[j](+d[columns[j]] || 0) &&
          y1 > y[j](+d[columns[j]] || 0)
        ).map(d => d.label)
      );
      window.dispatchEvent(new CustomEvent('selectionChanged', {
        detail: { selectedNames: selected }
      }));
    })
    .on("end", function(event) {
      if (!event.selection) {
        circle.classed("hidden", false);
        window.dispatchEvent(new CustomEvent('selectionChanged', {
          detail: { selectedNames: new Set(data.map(d => d.label)) }
        }));
      }
    });

  cell.call(splomBrush);

  // Labels
  svg.append("g")
    .style("font", "bold 10px sans-serif")
    .style("pointer-events", "none")
    .selectAll("text")
    .data(columns)
    .join("text")
    .attr("transform", (d, i) => `translate(${i * size},${i * size})`)
    .attr("x", padding)
    .attr("y", padding)
    .attr("dy", ".71em")
    .text(d => d);

  // Listen to PCP selection
  window.addEventListener('selectionChanged', (e) => {
    const selectedNames = e.detail.selectedNames;
    circle.classed("hidden", function() {
      const label = d3.select(this).attr("data-label");
      return selectedNames.size > 0 && !selectedNames.has(label);
    });
  });
}