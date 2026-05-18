const siteConfig = {
  url: "https://web-platform-dx.github.io/web-features-explorer/",
  strings: {
    formatting: {
      missingValue: "Not tracked",
    },
    statistics: {
      title: "Statistics",
      intro:
        "This page tracks how web-features coverage changes over time for browser-compat-data keys and caniuse IDs.",
      summaryLabel: "Latest statistics",
      summary: {
        features: {
          label: "Features",
          changeLabel: "features",
          valueLabel: "features on",
        },
        bcdKeysUnmapped: {
          label: "Unmapped BCD keys",
          changeLabel: "keys",
          valueLabel: "unmapped keys on",
        },
        bcdCoveragePercent: {
          label: "BCD coverage",
          changeLabel: "points",
          valueLabel: "coverage on",
          changeSuffix: " pp",
        },
        caniuseIdsUnmapped: {
          label: "Unmapped caniuse IDs",
          changeLabel: "IDs",
          valueLabel: "unmapped IDs on",
        },
        caniuseCoveragePercent: {
          label: "caniuse coverage",
          changeLabel: "points",
          valueLabel: "coverage on",
          changeSuffix: " pp",
        },
      },
      ranges: {
        label: "Chart time range",
        "1m": "1 month",
        "3m": "3 months",
        "6m": "6 months",
        "1y": "1 year",
        all: "All",
      },
      chart: {
        heading: "Coverage trends",
        datasets: {
          bcdKeysUnmapped: "Unmapped BCD keys",
          caniuseIdsUnmapped: "Unmapped caniuse IDs",
          features: "Features",
          bcdCoveragePercent: "BCD coverage",
          standardNonDeprecatedBcdCoveragePercent:
            "Standard non-deprecated BCD coverage",
          caniuseCoveragePercent: "caniuse coverage",
        },
        axes: {
          counts: "Count",
          percent: "Coverage (%)",
        },
        percentSuffix: "%",
        tooltipMissingValue: "n/a",
      },
      table: {
        summary: "Data table",
        heading: "Data table",
        caption: "web-features coverage statistics over time",
        columns: {
          date: "Date",
          features: "Features",
          bcdKeysMapped: "Mapped BCD keys",
          bcdKeysUnmapped: "Unmapped BCD keys",
          bcdCoveragePercent: "BCD coverage",
          standardNonDeprecatedBcdKeysMapped:
            "Mapped standard non-deprecated BCD keys",
          standardNonDeprecatedBcdKeysUnmapped:
            "Unmapped standard non-deprecated BCD keys",
          standardNonDeprecatedBcdCoveragePercent:
            "Standard non-deprecated BCD coverage",
          caniuseIdsMapped: "Mapped caniuse IDs",
          caniuseIdsUnmapped: "Unmapped caniuse IDs",
          caniuseCoveragePercent: "caniuse coverage",
        },
        mappedCountSeparator: " of ",
      },
      source: {
        beforeLink: "The underlying data is available in ",
        linkText: "statistics.json",
        betweenLinks:
          ". Historical rows before this page was added were seeded from weekly report comments in ",
        issueLinkText: "web-features issue #788",
        afterIssueLink:
          "; new rows are generated from installed package data when the site rebuilds.",
      },
    },
  },
};

export default siteConfig;
