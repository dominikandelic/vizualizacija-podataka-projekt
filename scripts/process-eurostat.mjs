import fs from "node:fs";

const rawPath = "data/eurostat_tesem150_raw.json";
const outPath = "data/neet.json";
const geoRawPath = "data/europe-countries.geojson";
const geoOutPath = "data/europe-neet.geojson";

const dataset = JSON.parse(fs.readFileSync(rawPath, "utf8"));
const dimensions = dataset.id;
const sizes = dataset.size;

const categories = Object.fromEntries(
  dimensions.map((id) => {
    const category = dataset.dimension[id].category;
    const byIndex = Object.entries(category.index)
      .sort((a, b) => a[1] - b[1])
      .map(([code]) => ({
        code,
        label: category.label?.[code] ?? code,
      }));

    return [id, byIndex];
  })
);

const rows = [];

function decodeIndex(flatIndex) {
  let rest = Number(flatIndex);
  const decoded = {};

  for (let i = dimensions.length - 1; i >= 0; i -= 1) {
    const size = sizes[i];
    const position = rest % size;
    rest = Math.floor(rest / size);
    decoded[dimensions[i]] = categories[dimensions[i]][position].code;
  }

  return decoded;
}

for (const [flatIndex, value] of Object.entries(dataset.value)) {
  const row = decodeIndex(flatIndex);
  rows.push({
    year: Number(row.time),
    geo: row.geo,
    country: dataset.dimension.geo.category.label[row.geo],
    sex: row.sex,
    sexLabel: dataset.dimension.sex.category.label[row.sex],
    age: row.age,
    ageLabel: dataset.dimension.age.category.label[row.age],
    value,
  });
}

const excludedAggregates = new Set(["EA21", "EA20", "EA19"]);
const filteredRows = rows
  .filter((row) => !excludedAggregates.has(row.geo))
  .sort((a, b) =>
    a.year - b.year ||
    a.country.localeCompare(b.country) ||
    a.age.localeCompare(b.age) ||
    a.sex.localeCompare(b.sex)
  );

const geos = categories.geo
  .filter((geo) => !excludedAggregates.has(geo.code))
  .map((geo) => ({
    code: geo.code,
    label: geo.label,
    isAggregate: geo.code === "EU27_2020",
  }));

const metadata = {
  title: dataset.label,
  source: "Eurostat TESEM150",
  sourceUrl: "https://ec.europa.eu/eurostat/databrowser/product/page/TESEM150",
  apiUrl: "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tesem150?training=NO_FE_NO_NFE&wstatus=NEMP&unit=PC",
  updated: dataset.updated,
  oldestYear: dataset.extension?.annotation?.find((item) => item.type === "OBS_PERIOD_OVERALL_OLDEST")?.title,
  latestYear: dataset.extension?.annotation?.find((item) => item.type === "OBS_PERIOD_OVERALL_LATEST")?.title,
  note: "Vrijednosti su postotci mladih osoba koje nisu zaposlene niti sudjeluju u formalnom ili neformalnom obrazovanju i osposobljavanju.",
};

fs.writeFileSync(
  outPath,
  JSON.stringify({ metadata, geos, rows: filteredRows }, null, 2)
);

console.log(`Wrote ${filteredRows.length} rows to ${outPath}`);

if (fs.existsSync(geoRawPath)) {
  const geosWithData = new Set(geos.map((geo) => geo.code).filter((code) => code !== "EU27_2020"));
  const geojson = JSON.parse(fs.readFileSync(geoRawPath, "utf8"));
  const europeBox = { minLon: -25, maxLon: 45, minLat: 34, maxLat: 72 };
  const isInEurope = ([lon, lat]) =>
    lon >= europeBox.minLon && lon <= europeBox.maxLon && lat >= europeBox.minLat && lat <= europeBox.maxLat;

  function keepEuropeanGeometry(geometry) {
    if (geometry.type === "Polygon") {
      return geometry.coordinates.some((ring) => ring.some(isInEurope)) ? geometry : null;
    }

    if (geometry.type === "MultiPolygon") {
      const coordinates = geometry.coordinates.filter((polygon) =>
        polygon.some((ring) => ring.some(isInEurope))
      );
      return coordinates.length ? { type: "MultiPolygon", coordinates } : null;
    }

    return null;
  }

  const features = geojson.features
    .filter((feature) => geosWithData.has(feature.properties.CNTR_ID))
    .map((feature) => {
      const geometry = keepEuropeanGeometry(feature.geometry);
      if (!geometry) return null;

      return {
        type: "Feature",
        properties: {
          CNTR_ID: feature.properties.CNTR_ID,
          NAME_ENGL: feature.properties.NAME_ENGL,
        },
        geometry,
      };
    })
    .filter(Boolean);

  fs.writeFileSync(
    geoOutPath,
    JSON.stringify({ type: "FeatureCollection", features }, null, 2)
  );
  console.log(`Wrote ${features.length} map features to ${geoOutPath}`);
}
