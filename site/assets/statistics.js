// @ts-check

/**
 * @typedef {"1m" | "3m" | "6m" | "1y" | "all"} StatisticsRange
 */

/**
 * @typedef {object} Snapshot
 * @property {string} date
 * @property {number} bcdKeysUnmapped
 * @property {number} caniuseIdsUnmapped
 * @property {number} features
 * @property {number} bcdCoveragePercent
 * @property {number | null} standardNonDeprecatedBcdCoveragePercent
 * @property {number} caniuseCoveragePercent
 */

const statisticsData = document.getElementById("statistics-data");
const statisticsConfig = document.getElementById("statistics-config");
const statisticsPage = document.querySelector(".statistics-page");
const statisticsRanges = /** @type {const} */ (["1m", "3m", "6m", "1y", "all"]);

const ranges = {
  "1m": 1,
  "3m": 3,
  "6m": 6,
  "1y": 12,
};

if (!statisticsData || !statisticsConfig || !statisticsPage) {
  throw new Error("Statistics page markup is incomplete.");
}

let statistics;
/** @type { typeof import('../../site.config.js').default.strings.statistics } */
let strings;

try {
  statistics = JSON.parse(statisticsData.textContent ?? "{}");
} catch (error) {
  throw new Error("Statistics data is malformed.", { cause: error });
}

try {
  strings = JSON.parse(statisticsConfig.textContent ?? "{}");
} catch (error) {
  throw new Error("Statistics config is malformed.", { cause: error });
}

const snapshots = statistics.snapshots;
const pageStyles = getComputedStyle(statisticsPage);
// @ts-expect-error - ApexCharts is a global loaded via passthrough
const ApexCharts = globalThis.ApexCharts;
const colors = {
  bcdUnmapped: pageStyles.getPropertyValue("--statistics-bcd-unmapped").trim(),
  caniuseUnmapped: pageStyles
    .getPropertyValue("--statistics-caniuse-unmapped")
    .trim(),
  features: pageStyles.getPropertyValue("--statistics-features").trim(),
  bcdCoverage: pageStyles.getPropertyValue("--statistics-bcd-coverage").trim(),
  standardBcdCoverage: pageStyles
    .getPropertyValue("--statistics-standard-bcd-coverage")
    .trim(),
  caniuseCoverage: pageStyles
    .getPropertyValue("--statistics-caniuse-coverage")
    .trim(),
  chartText: pageStyles.getPropertyValue("--statistics-chart-text").trim(),
  chartGrid: pageStyles.getPropertyValue("--statistics-chart-grid").trim(),
};

/**
 * @param {string} color
 */
function transparent(color) {
  return `${color}55`;
}

const lineDefaults = {
  strokeWidth: 3,
  markerSize: 4,
  markerShape: "circle",
};
const coverageDefaults = {
  ...lineDefaults,
  markerSize: 7,
};
const summaryDefinitions = {
  features: {
    format: formatNumber,
    changeLabel: strings.summary.features.changeLabel,
    valueLabel: strings.summary.features.valueLabel,
  },
  bcdKeysUnmapped: {
    format: formatNumber,
    changeLabel: strings.summary.bcdKeysUnmapped.changeLabel,
    valueLabel: strings.summary.bcdKeysUnmapped.valueLabel,
  },
  bcdCoveragePercent: {
    format: formatPercent,
    changeLabel: strings.summary.bcdCoveragePercent.changeLabel,
    valueLabel: strings.summary.bcdCoveragePercent.valueLabel,
    changeSuffix: strings.summary.bcdCoveragePercent.changeSuffix,
  },
  caniuseIdsUnmapped: {
    format: formatNumber,
    changeLabel: strings.summary.caniuseIdsUnmapped.changeLabel,
    valueLabel: strings.summary.caniuseIdsUnmapped.valueLabel,
  },
  caniuseCoveragePercent: {
    format: formatPercent,
    changeLabel: strings.summary.caniuseCoveragePercent.changeLabel,
    valueLabel: strings.summary.caniuseCoveragePercent.valueLabel,
    changeSuffix: strings.summary.caniuseCoveragePercent.changeSuffix,
  },
};
const datasetDefinitions = [
  {
    ...lineDefaults,
    label: strings.chart.datasets.bcdKeysUnmapped,
    getData: (/** @type {{ bcdKeysUnmapped: number }} */ snapshot) =>
      snapshot.bcdKeysUnmapped,
    color: colors.bcdUnmapped,
    yAxis: "counts",
  },
  {
    ...lineDefaults,
    label: strings.chart.datasets.caniuseIdsUnmapped,
    getData: (/** @type {{ caniuseIdsUnmapped: number }} */ snapshot) =>
      snapshot.caniuseIdsUnmapped,
    color: colors.caniuseUnmapped,
    yAxis: "counts",
  },
  {
    ...lineDefaults,
    label: strings.chart.datasets.features,
    getData: (/** @type {{ features: number }} */ snapshot) =>
      snapshot.features,
    color: colors.features,
    yAxis: "counts",
  },
  {
    ...coverageDefaults,
    label: strings.chart.datasets.bcdCoveragePercent,
    getData: (/** @type {{ bcdCoveragePercent: number }} */ snapshot) =>
      snapshot.bcdCoveragePercent,
    color: colors.bcdCoverage,
    markerShape: "diamond",
    yAxis: "percent",
  },
  {
    ...coverageDefaults,
    label: strings.chart.datasets.standardNonDeprecatedBcdCoveragePercent,
    getData: (
      /** @type {{ standardNonDeprecatedBcdCoveragePercent: number | null }} */ snapshot,
    ) => snapshot.standardNonDeprecatedBcdCoveragePercent,
    color: colors.standardBcdCoverage,
    markerShape: "triangle",
    yAxis: "percent",
  },
  {
    ...coverageDefaults,
    label: strings.chart.datasets.caniuseCoveragePercent,
    getData: (/** @type {{ caniuseCoveragePercent: number }} */ snapshot) =>
      snapshot.caniuseCoveragePercent,
    color: colors.caniuseCoverage,
    markerShape: "star",
    yAxis: "percent",
  },
];

/**
 * @param {StatisticsRange} range
 * @returns {Snapshot[]}
 */
function getSnapshotsForRange(range) {
  if (range === "all") {
    return snapshots;
  }

  const latestSnapshot = snapshots.at(-1);

  if (!latestSnapshot) {
    return [];
  }

  const latestDate = new Date(latestSnapshot.date);
  const startDate = new Date(latestDate);

  startDate.setMonth(startDate.getMonth() - ranges[range]);

  return snapshots.filter((/** @type {{ date: string }} */ snapshot) => {
    return new Date(snapshot.date) >= startDate;
  });
}

/**
 * @param {string | null} range
 * @returns {range is StatisticsRange}
 */
function isStatisticsRange(range) {
  return statisticsRanges.includes(/** @type {StatisticsRange} */ (range));
}

/**
 * @param {number} value
 */
function formatNumber(value) {
  return value.toLocaleString("en-US");
}

/**
 * @param {number} value
 */
function formatPercent(value) {
  return `${value.toFixed(2)}%`;
}

/**
 * @param {number} value
 * @param {{ changeLabel: string, changeSuffix?: string }} definition
 */
function formatChangeValue(value, definition) {
  if (value === 0) {
    return "0";
  }

  const formattedValue = definition.changeSuffix
    ? Math.abs(value).toFixed(2)
    : formatNumber(Math.abs(value));
  const sign = value > 0 ? "+" : "-";
  const suffix = definition.changeSuffix ?? "";

  return `${sign}${formattedValue}${suffix}`;
}

/**
 * @param {Array<Record<string, number | string | null>>} filteredSnapshots
 */
function updateSummary(filteredSnapshots) {
  const firstSnapshot = filteredSnapshots[0];
  const latestSnapshot = filteredSnapshots.at(-1);

  if (!firstSnapshot || !latestSnapshot) {
    return;
  }

  Object.entries(summaryDefinitions).forEach(([key, definition]) => {
    const card = document.querySelector(`[data-summary-card="${key}"]`);

    if (!card) {
      return;
    }

    const value = card.querySelector("[data-summary-value]");
    const change = /** @type {HTMLElement | null} */ (
      card.querySelector("[data-summary-change]")
    );

    if (!value || !change) {
      return;
    }

    const latestValue = Number(latestSnapshot[key]);
    const delta = latestValue - Number(firstSnapshot[key]);

    value.textContent = formatChangeValue(delta, definition);
    change.textContent = `${definition.format(latestValue)} ${definition.valueLabel} ${latestSnapshot.date}`;
    change.dataset.direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  });
}

/**
 * @param {StatisticsRange} range
 */
function getChartSeries(range) {
  const filteredSnapshots = getSnapshotsForRange(range);

  return datasetDefinitions.map((definition) => ({
    name: definition.label,
    data: filteredSnapshots.map((snapshot) => ({
      x: snapshot.date,
      y: definition.getData(snapshot),
    })),
  }));
}

/**
 * @param {StatisticsRange} range
 */
function getXAxisRange(range) {
  const filteredSnapshots = getSnapshotsForRange(range);
  const firstSnapshot = filteredSnapshots[0];
  const latestSnapshot = filteredSnapshots.at(-1);

  if (!firstSnapshot || !latestSnapshot) {
    return {};
  }

  return {
    max: new Date(latestSnapshot.date).getTime(),
    min: new Date(firstSnapshot.date).getTime(),
  };
}

/**
 * @param {number} value
 */
function getRoundedAxisMax(value) {
  if (value <= 0) {
    return 0;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = magnitude / 2;

  return Math.ceil(value / step) * step;
}

/**
 * @param {StatisticsRange} range
 */
function getYAxisOptions(range) {
  const filteredSnapshots = getSnapshotsForRange(range);
  const countMax = getRoundedAxisMax(
    Math.max(
      ...filteredSnapshots.flatMap((snapshot) =>
        datasetDefinitions
          .filter((definition) => definition.yAxis === "counts")
          .map((definition) => Number(definition.getData(snapshot) ?? 0)),
      ),
    ),
  );

  return datasetDefinitions.map((definition, index) => {
    const isCountsAxis = definition.yAxis === "counts";
    const isFirstCountsAxis =
      index ===
      datasetDefinitions.findIndex((entry) => entry.yAxis === "counts");
    const isFirstPercentAxis =
      index ===
      datasetDefinitions.findIndex((entry) => entry.yAxis === "percent");

    return {
      labels: {
        show: isFirstCountsAxis || isFirstPercentAxis,
        style: {
          colors: colors.chartText,
        },
      },
      max: isCountsAxis ? countMax : 100,
      min: 0,
      opposite: !isCountsAxis,
      seriesName: definition.label,
      show: isFirstCountsAxis || isFirstPercentAxis,
      title: {
        style: {
          color: colors.chartText,
        },
        text: isFirstCountsAxis
          ? strings.chart.axes.counts
          : isFirstPercentAxis
            ? strings.chart.axes.percent
            : undefined,
      },
    };
  });
}

const chartContainer = /** @type {HTMLElement | null} */ (
  document.getElementById("statistics-chart")
);

if (!chartContainer) {
  throw new Error("Statistics chart container is missing.");
}

if (!ApexCharts) {
  throw new Error("ApexCharts is missing.");
}

const chart = new ApexCharts(chartContainer, {
  chart: {
    animations: {
      enabled: false,
    },
    height: "100%",
    toolbar: {
      show: false,
    },
    type: "line",
    width: "100%",
    zoom: {
      enabled: false,
    },
  },
  colors: datasetDefinitions.map((definition) => definition.color),
  dataLabels: {
    enabled: false,
  },
  grid: {
    borderColor: colors.chartGrid,
  },
  legend: {
    fontSize: "14px",
    labels: {
      colors: colors.chartText,
    },
    markers: {
      shape: datasetDefinitions.map((definition) => definition.markerShape),
      size: 7,
    },
    position: "top",
  },
  markers: {
    colors: datasetDefinitions.map((definition) =>
      transparent(definition.color),
    ),
    hover: {
      sizeOffset: 4,
    },
    shape: datasetDefinitions.map((definition) => definition.markerShape),
    showNullDataPoints: false,
    size: datasetDefinitions.map((definition) => definition.markerSize),
    strokeColors: datasetDefinitions.map((definition) => definition.color),
    strokeWidth: 2,
  },
  series: getChartSeries("1m"),
  stroke: {
    curve: "straight",
    width: datasetDefinitions.map((definition) => definition.strokeWidth),
  },
  tooltip: {
    hideEmptySeries: false,
    intersect: false,
    shared: true,
    x: {
      /**
       *
       * @param {string} value
       */
      formatter(value) {
        return new Date(value).toISOString().slice(0, 10);
      },
    },
    y: {
      /**
       *
       * @param {Date} value
       * @param {{ seriesIndex: number }} options
       */
      formatter(value, options) {
        if (value === null || typeof value === "undefined") {
          return strings.chart.tooltipMissingValue;
        }

        const definition = datasetDefinitions[options.seriesIndex];
        const suffix =
          definition?.yAxis === "percent" ? strings.chart.percentSuffix : "";

        return `${value.toLocaleString("en-US")}${suffix}`;
      },
    },
  },
  xaxis: {
    labels: {
      datetimeUTC: false,
      rotate: 0,
      style: {
        colors: colors.chartText,
      },
    },
    ...getXAxisRange("1m"),
    type: "datetime",
  },
  yaxis: getYAxisOptions("1m"),
});

chart.render();
updateSummary(getSnapshotsForRange("1m"));

const rangeControls = document.querySelector(".statistics-chart-controls");
const rangeButtons = document.querySelectorAll(
  ".statistics-chart-controls button",
);

if (!rangeControls) {
  throw new Error("Statistics chart controls are missing.");
}

/**
 * @param {HTMLButtonElement} selectedButton
 */
function updateSelectedRangeButton(selectedButton) {
  rangeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button === selectedButton));
  });
}

rangeControls.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const button = event.target.closest("button");

  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const range = button.getAttribute("data-range");

  if (!isStatisticsRange(range)) {
    return;
  }

  updateSelectedRangeButton(button);
  chart.updateOptions({
    series: getChartSeries(range),
    xaxis: getXAxisRange(range),
    yaxis: getYAxisOptions(range),
  });
  updateSummary(getSnapshotsForRange(range));
});
