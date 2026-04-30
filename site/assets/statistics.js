// @ts-check

/**
 * @typedef {"1m" | "3m" | "6m" | "1y" | "all"} StatisticsRange
 */

const statisticsData = document.getElementById("statistics-data");
const statisticsPage = document.querySelector(".statistics-page");
const statisticsRanges = /** @type {const} */ (["1m", "3m", "6m", "1y", "all"]);

if (!statisticsData || !statisticsPage) {
  throw new Error("Statistics page markup is incomplete.");
}

let statistics;

try {
  statistics = JSON.parse(statisticsData.textContent ?? "{}");
} catch (error) {
  throw new Error("Statistics data is malformed.", { cause: error });
}

const snapshots = statistics.snapshots;
const pageStyles = getComputedStyle(statisticsPage);
const Chart = /** @type {{ Chart: typeof import("chart.js").Chart }} */ (
  /** @type {unknown} */ (globalThis)
).Chart;
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
  borderWidth: 3,
  pointBorderWidth: 2,
  pointRadius: 4,
  pointHoverRadius: 8,
  tension: 0,
};
const coverageDefaults = {
  ...lineDefaults,
  pointRadius: 7,
  pointHoverRadius: 11,
};
const summaryDefinitions = {
  features: {
    format: formatNumber,
    changeLabel: "features",
    valueLabel: "features on",
  },
  bcdKeysUnmapped: {
    format: formatNumber,
    changeLabel: "keys",
    valueLabel: "unmapped keys on",
  },
  bcdCoveragePercent: {
    format: formatPercent,
    changeLabel: "points",
    valueLabel: "coverage on",
  },
  caniuseIdsUnmapped: {
    format: formatNumber,
    changeLabel: "IDs",
    valueLabel: "unmapped IDs on",
  },
  caniuseCoveragePercent: {
    format: formatPercent,
    changeLabel: "points",
    valueLabel: "coverage on",
  },
};
const datasetDefinitions = [
  {
    ...lineDefaults,
    label: "Unmapped BCD keys",
    getData: (/** @type {{ bcdKeysUnmapped: number }} */ snapshot) =>
      snapshot.bcdKeysUnmapped,
    borderColor: colors.bcdUnmapped,
    backgroundColor: transparent(colors.bcdUnmapped),
    pointBorderColor: colors.bcdUnmapped,
    pointBackgroundColor: transparent(colors.bcdUnmapped),
    yAxisID: "counts",
  },
  {
    ...lineDefaults,
    label: "Unmapped caniuse IDs",
    getData: (/** @type {{ caniuseIdsUnmapped: number }} */ snapshot) =>
      snapshot.caniuseIdsUnmapped,
    borderColor: colors.caniuseUnmapped,
    backgroundColor: transparent(colors.caniuseUnmapped),
    pointBorderColor: colors.caniuseUnmapped,
    pointBackgroundColor: transparent(colors.caniuseUnmapped),
    yAxisID: "counts",
  },
  {
    ...lineDefaults,
    label: "Features",
    getData: (/** @type {{ features: number }} */ snapshot) =>
      snapshot.features,
    borderColor: colors.features,
    backgroundColor: transparent(colors.features),
    pointBorderColor: colors.features,
    pointBackgroundColor: transparent(colors.features),
    yAxisID: "counts",
  },
  {
    ...coverageDefaults,
    label: "BCD coverage",
    getData: (/** @type {{ bcdCoveragePercent: number }} */ snapshot) =>
      snapshot.bcdCoveragePercent,
    borderColor: colors.bcdCoverage,
    backgroundColor: transparent(colors.bcdCoverage),
    pointBorderColor: colors.bcdCoverage,
    pointBackgroundColor: transparent(colors.bcdCoverage),
    pointStyle: "rectRot",
    yAxisID: "percent",
  },
  {
    ...coverageDefaults,
    label: "Standard non-deprecated BCD coverage",
    getData: (
      /** @type {{ standardNonDeprecatedBcdCoveragePercent: number | null }} */ snapshot,
    ) => snapshot.standardNonDeprecatedBcdCoveragePercent,
    borderColor: colors.standardBcdCoverage,
    backgroundColor: transparent(colors.standardBcdCoverage),
    pointBorderColor: colors.standardBcdCoverage,
    pointBackgroundColor: transparent(colors.standardBcdCoverage),
    pointStyle: "triangle",
    spanGaps: true,
    yAxisID: "percent",
  },
  {
    ...coverageDefaults,
    label: "caniuse coverage",
    getData: (/** @type {{ caniuseCoveragePercent: number }} */ snapshot) =>
      snapshot.caniuseCoveragePercent,
    borderColor: colors.caniuseCoverage,
    backgroundColor: transparent(colors.caniuseCoverage),
    pointBorderColor: colors.caniuseCoverage,
    pointBackgroundColor: transparent(colors.caniuseCoverage),
    pointStyle: "star",
    yAxisID: "percent",
  },
];

/**
 * @param {StatisticsRange} range
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
  const ranges = {
    "1m": 1,
    "3m": 3,
    "6m": 6,
    "1y": 12,
  };
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
 * @param {string} label
 */
function formatChangeValue(value, label) {
  if (value === 0) {
    return "0";
  }

  const formattedValue =
    label === "points"
      ? Math.abs(value).toFixed(2)
      : formatNumber(Math.abs(value));
  const sign = value > 0 ? "+" : "-";
  const suffix = label === "points" ? " pp" : "";

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

    value.textContent = formatChangeValue(delta, definition.changeLabel);
    change.textContent = `${definition.format(latestValue)} ${definition.valueLabel} ${latestSnapshot.date}`;
    change.dataset.direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  });
}

/**
 * @param {StatisticsRange} range
 */
function getChartData(range) {
  const filteredSnapshots = getSnapshotsForRange(range);

  return {
    labels: filteredSnapshots.map(
      (/** @type {{ date: string }} */ snapshot) => snapshot.date,
    ),
    datasets: datasetDefinitions.map(({ getData, ...definition }) => {
      return {
        ...definition,
        data: filteredSnapshots.map(getData),
      };
    }),
  };
}

const chartCanvas = /** @type {HTMLCanvasElement | null} */ (
  document.getElementById("statistics-chart")
);

if (!chartCanvas) {
  throw new Error("Statistics chart canvas is missing.");
}

const chart = new Chart(chartCanvas, {
  type: "line",
  data: getChartData("1m"),
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        position: "top",
        labels: {
          boxHeight: 14,
          boxWidth: 42,
          color: colors.chartText,
          font: {
            size: 14,
          },
          padding: 16,
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          label(context) {
            const suffix = context.dataset.yAxisID === "percent" ? "%" : "";
            const value = context.parsed.y;

            if (value === null) {
              return `${context.dataset.label}: n/a`;
            }

            return `${context.dataset.label}: ${value.toLocaleString("en-US")}${suffix}`;
          },
        },
      },
    },
    scales: {
      counts: {
        type: "linear",
        position: "left",
        ticks: {
          color: colors.chartText,
        },
        title: {
          display: true,
          text: "Count",
          color: colors.chartText,
        },
        grid: {
          color: colors.chartGrid,
        },
      },
      percent: {
        type: "linear",
        position: "right",
        min: 0,
        max: 100,
        ticks: {
          color: colors.chartText,
        },
        title: {
          display: true,
          text: "Coverage (%)",
          color: colors.chartText,
        },
        grid: {
          drawOnChartArea: false,
        },
      },
      x: {
        ticks: {
          color: colors.chartText,
          maxRotation: 0,
          autoSkipPadding: 24,
        },
        grid: {
          color: colors.chartGrid,
        },
      },
    },
  },
});

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
  chart.data = getChartData(range);
  updateSummary(getSnapshotsForRange(range));
  chart.update();
});
