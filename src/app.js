const state = {
  year: 2024,
  age: "Y15-29",
  sex: "T",
  sort: "desc",
  selected: ["HR", "EU27_2020", "SI", "DE"],
  timer: null,
};

const colors = new Map([
  ["HR", "#bd5647"],
  ["EU27_2020", "#2f6f5e"],
  ["SI", "#3867a6"],
  ["DE", "#d59c36"],
]);

const fallbackColors = d3.schemeTableau10;
const countryShort = {
  EU27_2020: "EU-27",
  HR: "Hrvatska",
};

const els = {
  age: document.querySelector("#ageSelect"),
  sex: document.querySelector("#sexSelect"),
  sort: document.querySelector("#sortSelect"),
  year: document.querySelector("#yearSlider"),
  yearLabel: document.querySelector("#yearLabel"),
  play: document.querySelector("#playButton"),
  croatiaMetric: document.querySelector("#croatiaMetric"),
  euMetric: document.querySelector("#euMetric"),
  gapMetric: document.querySelector("#gapMetric"),
  selectedMetric: document.querySelector("#selectedMetric"),
  insightTitle: document.querySelector("#insightTitle"),
  insightText: document.querySelector("#insightText"),
  countryList: document.querySelector("#countryList"),
  legend: document.querySelector("#legend"),
  mapLegend: document.querySelector("#mapLegend"),
  tooltip: document.querySelector("#tooltip"),
};

let rows = [];
let geos = [];
let mapFeatures = [];
let byKey = new Map();

d3.json("data/neet.json").then((data) => Promise.all([data, d3.json("data/europe-neet.geojson")])).then(([data, mapData]) => {
  rows = data.rows;
  geos = data.geos;
  mapFeatures = mapData.features;
  byKey = new Map(rows.map((row) => [key(row.geo, row.year, row.age, row.sex), row]));
  setupControls(data.metadata);
  updateAll();
});

function key(geo, year, age, sex) {
  return `${geo}|${year}|${age}|${sex}`;
}

function getRow(geo, year = state.year, age = state.age, sex = state.sex) {
  return byKey.get(key(geo, year, age, sex));
}

function getValue(geo, year = state.year, age = state.age, sex = state.sex) {
  return getRow(geo, year, age, sex)?.value ?? null;
}

function labelFor(geo) {
  return countryShort[geo] ?? geos.find((item) => item.code === geo)?.label ?? geo;
}

function colorFor(geo) {
  if (!colors.has(geo)) {
    colors.set(geo, fallbackColors[colors.size % fallbackColors.length]);
  }
  return colors.get(geo);
}

function fmt(value) {
  return value == null || Number.isNaN(value) ? "-" : `${d3.format(".1f")(value)}%`;
}

function setupControls(metadata) {
  const years = rows.map((row) => row.year);
  const minYear = d3.min(years);
  const maxYear = d3.max(years);

  els.year.min = minYear;
  els.year.max = maxYear;
  els.year.value = state.year;

  els.age.addEventListener("change", (event) => {
    state.age = event.target.value;
    updateAll();
  });

  els.sex.addEventListener("change", (event) => {
    state.sex = event.target.value;
    updateAll();
  });

  els.sort.addEventListener("change", (event) => {
    state.sort = event.target.value;
    updateAll();
  });

  els.year.addEventListener("input", (event) => {
    state.year = Number(event.target.value);
    updateAll();
  });

  els.play.addEventListener("click", togglePlay);

  document.querySelector(".source-card strong").textContent = `${metadata.source} (${metadata.oldestYear}-${metadata.latestYear})`;
}

function togglePlay() {
  if (state.timer) {
    state.timer.stop();
    state.timer = null;
    els.play.textContent = "Pokreni animaciju";
    els.play.setAttribute("aria-pressed", "false");
    return;
  }

  els.play.textContent = "Zaustavi animaciju";
  els.play.setAttribute("aria-pressed", "true");
  state.timer = d3.interval(() => {
    const nextYear = state.year >= Number(els.year.max) ? Number(els.year.min) : state.year + 1;
    state.year = nextYear;
    els.year.value = nextYear;
    updateAll();
  }, 950);
}

function updateAll() {
  els.yearLabel.textContent = state.year;
  drawMetrics();
  drawMapChart();
  drawBarChart();
  drawLineChart();
  drawGenderChart();
  drawNotes();
}

function currentCountryRows() {
  const items = geos
    .filter((geo) => geo.code !== "EU27_2020")
    .map((geo) => {
      const current = getRow(geo.code);
      const first = getRow(geo.code, 2005);
      return {
        geo: geo.code,
        country: labelFor(geo.code),
        value: current?.value ?? null,
        change: current && first ? current.value - first.value : null,
      };
    })
    .filter((row) => row.value != null);

  if (state.sort === "asc") return items.sort((a, b) => a.value - b.value);
  if (state.sort === "alpha") return items.sort((a, b) => a.country.localeCompare(b.country));
  if (state.sort === "change") return items.sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0));
  return items.sort((a, b) => b.value - a.value);
}

function drawMetrics() {
  const hr = getValue("HR");
  const eu = getValue("EU27_2020");
  const gap = hr != null && eu != null ? hr - eu : null;

  els.croatiaMetric.textContent = fmt(hr);
  els.euMetric.textContent = fmt(eu);
  els.gapMetric.textContent = gap == null ? "-" : `${gap >= 0 ? "+" : ""}${d3.format(".1f")(gap)} p.p.`;
  els.selectedMetric.textContent = `${state.selected.length}`;
}

function drawBarChart() {
  const svg = d3.select("#barChart");
  const width = svg.node().clientWidth || 720;
  const data = currentCountryRows();
  const height = Math.max(620, data.length * 24 + 70);
  const margin = { top: 18, right: 54, bottom: 36, left: 150 };

  svg.attr("viewBox", `0 0 ${width} ${height}`);

  const x = d3.scaleLinear()
    .domain([0, d3.max(data, (d) => d.value) * 1.08])
    .range([margin.left, width - margin.right]);

  const y = d3.scaleBand()
    .domain(data.map((d) => d.geo))
    .range([margin.top, height - margin.bottom])
    .padding(0.2);

  svg.selectAll(".x-axis")
    .data([null])
    .join("g")
    .attr("class", "axis x-axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .transition()
    .duration(450)
    .call(d3.axisBottom(x).ticks(6).tickFormat((d) => `${d}%`));

  svg.selectAll(".y-axis")
    .data([null])
    .join("g")
    .attr("class", "axis y-axis")
    .attr("transform", `translate(${margin.left},0)`)
    .transition()
    .duration(450)
    .call(d3.axisLeft(y).tickFormat(labelFor).tickSize(0));

  svg.selectAll(".grid")
    .data([null])
    .join("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .transition()
    .duration(450)
    .call(d3.axisBottom(x).ticks(6).tickSize(-(height - margin.top - margin.bottom)).tickFormat(""));

  const bars = svg.selectAll("rect.bar")
    .data(data, (d) => d.geo);

  bars.join(
    (enter) => enter.append("rect")
      .attr("class", "bar")
      .attr("data-geo", (d) => d.geo)
      .attr("x", margin.left)
      .attr("y", (d) => y(d.geo))
      .attr("height", y.bandwidth())
      .attr("width", 0)
      .attr("fill", (d) => state.selected.includes(d.geo) ? colorFor(d.geo) : "#b9ab95")
      .call((selection) => selection.transition().duration(600).attr("width", (d) => x(d.value) - margin.left)),
    (update) => update,
    (exit) => exit.call((selection) => selection.transition().duration(350).attr("width", 0).remove())
  )
    .on("click", (_, d) => toggleCountry(d.geo))
    .on("mousemove", showTooltip)
    .on("mouseleave", hideTooltip)
    .transition()
    .duration(600)
    .attr("x", margin.left)
    .attr("data-geo", (d) => d.geo)
    .attr("y", (d) => y(d.geo))
    .attr("height", y.bandwidth())
    .attr("width", (d) => x(d.value) - margin.left)
    .attr("fill", (d) => state.selected.includes(d.geo) ? colorFor(d.geo) : "#b9ab95");

  svg.selectAll("text.value-label")
    .data(data, (d) => d.geo)
    .join(
      (enter) => enter.append("text")
        .attr("class", "value-label")
        .attr("x", margin.left)
        .attr("y", (d) => y(d.geo) + y.bandwidth() / 2 + 4)
        .text((d) => fmt(d.value)),
      (update) => update,
      (exit) => exit.remove()
    )
    .transition()
    .duration(600)
    .attr("x", (d) => x(d.value) + 8)
    .attr("y", (d) => y(d.geo) + y.bandwidth() / 2 + 4)
    .text((d) => fmt(d.value));
}

function drawMapChart() {
  const svg = d3.select("#mapChart");
  const width = svg.node().clientWidth || 980;
  const height = width < 700 ? 360 : 430;
  const mapRows = currentCountryRows();
  const values = new Map(mapRows.map((row) => [row.geo, row.value]));
  const extent = d3.extent([...values.values()]);
  const color = d3.scaleLinear()
    .domain([extent[0], (extent[0] + extent[1]) / 2, extent[1]])
    .range(["#f0e4cc", "#d59c36", "#bd5647"]);

  const data = mapFeatures.map((feature) => {
    const geo = feature.properties.CNTR_ID;
    return {
      ...feature,
      geo,
      country: labelFor(geo),
      value: values.get(geo) ?? null,
    };
  });
  const featureCollection = { type: "FeatureCollection", features: data };
  const projection = d3.geoMercator().fitExtent([[18, 14], [width - 18, height - 24]], featureCollection);
  const path = d3.geoPath(projection);

  svg.attr("viewBox", `0 0 ${width} ${height}`);

  svg.selectAll("path.country-shape")
    .data(data, (d) => d.geo)
    .join(
      (enter) => enter.append("path")
        .attr("class", "country-shape")
        .attr("data-geo", (d) => d.geo)
        .attr("d", path)
        .attr("fill", "#ddd2bf")
        .attr("opacity", 0)
        .call((selection) => selection.transition().duration(500).attr("opacity", 1)),
      (update) => update,
      (exit) => exit.transition().duration(250).attr("opacity", 0).remove()
    )
    .classed("is-selected", (d) => state.selected.includes(d.geo))
    .on("click", (_, d) => toggleCountry(d.geo))
    .on("mousemove", showTooltip)
    .on("mouseleave", hideTooltip)
    .transition()
    .duration(600)
    .attr("opacity", 1)
    .attr("data-geo", (d) => d.geo)
    .attr("d", path)
    .attr("fill", (d) => d.value == null ? "#ddd2bf" : color(d.value));

  const labels = ["HR", "SI", "DE", "IT", "ES", "FR", "PL", "RO", "SE", "TR"];
  svg.selectAll("text.map-label")
    .data(data.filter((d) => labels.includes(d.geo) && path.centroid(d).every(Number.isFinite)), (d) => d.geo)
    .join("text")
    .attr("class", "map-label")
    .attr("x", (d) => path.centroid(d)[0])
    .attr("y", (d) => path.centroid(d)[1])
    .attr("text-anchor", "middle")
    .text((d) => d.geo);

  els.mapLegend.innerHTML = `
    <span>${fmt(extent[0])}</span>
    <span class="map-ramp"></span>
    <span>${fmt(extent[1])}</span>
  `;
}

function drawLineChart() {
  const svg = d3.select("#lineChart");
  const width = svg.node().clientWidth || 640;
  const height = 330;
  const margin = { top: 24, right: 24, bottom: 38, left: 48 };
  const years = d3.range(Number(els.year.min), Number(els.year.max) + 1);
  const series = state.selected.map((geo) => ({
    geo,
    country: labelFor(geo),
    values: years.map((year) => ({ year, value: getValue(geo, year) })).filter((d) => d.value != null),
  }));

  const allValues = series.flatMap((item) => item.values.map((d) => d.value));
  svg.attr("viewBox", `0 0 ${width} ${height}`);

  const x = d3.scaleLinear().domain(d3.extent(years)).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear()
    .domain([0, Math.max(18, d3.max(allValues) * 1.15)])
    .nice()
    .range([height - margin.bottom, margin.top]);

  svg.selectAll(".x-axis")
    .data([null])
    .join("g")
    .attr("class", "axis x-axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(6));

  svg.selectAll(".y-axis")
    .data([null])
    .join("g")
    .attr("class", "axis y-axis")
    .attr("transform", `translate(${margin.left},0)`)
    .transition()
    .duration(500)
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}%`));

  const line = d3.line()
    .x((d) => x(d.year))
    .y((d) => y(d.value))
    .curve(d3.curveMonotoneX);

  svg.selectAll("path.trend-line")
    .data(series, (d) => d.geo)
    .join(
      (enter) => enter.append("path")
        .attr("class", "trend-line")
        .attr("fill", "none")
        .attr("stroke-width", 3)
        .attr("stroke", (d) => colorFor(d.geo))
        .attr("d", (d) => line(d.values))
        .attr("opacity", 0)
        .call((selection) => selection.transition().duration(500).attr("opacity", 1)),
      (update) => update,
      (exit) => exit.transition().duration(350).attr("opacity", 0).remove()
    )
    .transition()
    .duration(600)
    .attr("opacity", 1)
    .attr("stroke", (d) => colorFor(d.geo))
    .attr("d", (d) => line(d.values));

  const points = series.map((item) => ({
    geo: item.geo,
    country: item.country,
    year: state.year,
    value: getValue(item.geo),
  })).filter((d) => d.value != null);

  svg.selectAll("circle.year-point")
    .data(points, (d) => d.geo)
    .join(
      (enter) => enter.append("circle")
        .attr("class", "year-point")
        .attr("r", 0)
        .attr("fill", (d) => colorFor(d.geo))
        .attr("cx", (d) => x(d.year))
        .attr("cy", (d) => y(d.value))
        .call((selection) => selection.transition().duration(500).attr("r", 5)),
      (update) => update,
      (exit) => exit.transition().duration(250).attr("r", 0).remove()
    )
    .transition()
    .duration(500)
    .attr("cx", (d) => x(d.year))
    .attr("cy", (d) => y(d.value))
    .attr("fill", (d) => colorFor(d.geo));

  els.legend.replaceChildren(...series.map((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `<i style="background:${colorFor(item.geo)}"></i>${item.country}`;
    button.addEventListener("click", () => toggleCountry(item.geo));
    return button;
  }));
}

function drawGenderChart() {
  const svg = d3.select("#genderChart");
  const width = svg.node().clientWidth || 640;
  const height = 330;
  const margin = { top: 24, right: 18, bottom: 44, left: 48 };
  const shown = state.selected.slice(0, 6);
  const data = shown.flatMap((geo) => ["F", "M"].map((sex) => ({
    geo,
    country: labelFor(geo),
    sex,
    sexLabel: sex === "F" ? "Žene" : "Muškarci",
    value: getValue(geo, state.year, state.age, sex),
  }))).filter((d) => d.value != null);

  svg.attr("viewBox", `0 0 ${width} ${height}`);

  const x0 = d3.scaleBand().domain(shown).range([margin.left, width - margin.right]).padding(0.24);
  const x1 = d3.scaleBand().domain(["F", "M"]).range([0, x0.bandwidth()]).padding(0.12);
  const y = d3.scaleLinear()
    .domain([0, Math.max(18, d3.max(data, (d) => d.value) * 1.2)])
    .nice()
    .range([height - margin.bottom, margin.top]);

  svg.selectAll(".x-axis")
    .data([null])
    .join("g")
    .attr("class", "axis x-axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x0).tickFormat(labelFor));

  svg.selectAll(".y-axis")
    .data([null])
    .join("g")
    .attr("class", "axis y-axis")
    .attr("transform", `translate(${margin.left},0)`)
    .transition()
    .duration(500)
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}%`));

  svg.selectAll("rect.gender-bar")
    .data(data, (d) => `${d.geo}-${d.sex}`)
    .join(
      (enter) => enter.append("rect")
        .attr("class", "gender-bar")
        .attr("x", (d) => x0(d.geo) + x1(d.sex))
        .attr("y", height - margin.bottom)
        .attr("width", x1.bandwidth())
        .attr("height", 0)
        .attr("fill", (d) => d.sex === "F" ? "#bd5647" : "#3867a6"),
      (update) => update,
      (exit) => exit.transition().duration(300).attr("height", 0).attr("y", height - margin.bottom).remove()
    )
    .on("mousemove", showTooltip)
    .on("mouseleave", hideTooltip)
    .transition()
    .duration(600)
    .attr("x", (d) => x0(d.geo) + x1(d.sex))
    .attr("y", (d) => y(d.value))
    .attr("width", x1.bandwidth())
    .attr("height", (d) => height - margin.bottom - y(d.value));

  svg.selectAll("text.gender-label")
    .data(data, (d) => `${d.geo}-${d.sex}`)
    .join(
      (enter) => enter.append("text").attr("class", "value-label gender-label"),
      (update) => update,
      (exit) => exit.remove()
    )
    .transition()
    .duration(600)
    .attr("x", (d) => x0(d.geo) + x1(d.sex) + x1.bandwidth() / 2)
    .attr("y", (d) => y(d.value) - 6)
    .attr("text-anchor", "middle")
    .text((d) => fmt(d.value));
}

function drawNotes() {
  const hr = getValue("HR");
  const eu = getValue("EU27_2020");
  const gap = hr != null && eu != null ? hr - eu : null;
  const direction = gap == null ? "" : gap >= 0 ? "višu" : "nižu";

  els.insightTitle.textContent = `Odabrana godina: ${state.year}`;
  els.insightText.textContent = gap == null
    ? "Za odabranu kombinaciju nema dovoljno podataka za usporedbu Hrvatske i EU prosjeka."
    : `Za dobnu skupinu ${state.age === "Y15-29" ? "15-29" : "15-24"} Hrvatska ima ${Math.abs(gap).toFixed(1)} postotnih bodova ${direction} NEET stopu od prosjeka EU-27. Klikom na stupce mogu se dodati države za izravnu usporedbu u linijskom i spolnom prikazu.`;

  els.countryList.replaceChildren(...state.selected.map((geo) => {
    const pill = document.createElement("div");
    pill.className = "country-pill";
    pill.innerHTML = `<span>${labelFor(geo)} <strong>${fmt(getValue(geo))}</strong></span>`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "makni";
    remove.addEventListener("click", () => toggleCountry(geo));
    pill.append(remove);
    return pill;
  }));
}

function toggleCountry(geo) {
  const isSelected = state.selected.includes(geo);
  if (isSelected && state.selected.length > 1) {
    state.selected = state.selected.filter((item) => item !== geo);
  } else if (!isSelected) {
    state.selected = [...state.selected, geo].slice(-6);
  }
  updateAll();
}

function showTooltip(event, d) {
  els.tooltip.hidden = false;
  els.tooltip.innerHTML = `<strong>${d.country ?? labelFor(d.geo)}</strong>${d.sexLabel ? `${d.sexLabel}<br>` : ""}${state.year}: ${fmt(d.value)}`;
  els.tooltip.style.left = `${event.clientX + 14}px`;
  els.tooltip.style.top = `${event.clientY + 14}px`;
}

function hideTooltip() {
  els.tooltip.hidden = true;
}

window.addEventListener("resize", () => updateAll());
