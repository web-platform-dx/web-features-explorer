const siteConfig = {
  url: "https://web-platform-dx.github.io/web-features-explorer/",
  openGraph: {
    outputDir: "docs/assets/og",
    featureOutputDir: "docs/assets/og/features",
    brandSrc: "https://web-platform-dx.github.io/assets/img/webdx-notext.svg",
    browserIcons: {
      chrome: "site/assets/chrome.svg",
      edge: "site/assets/edge.svg",
      firefox: "site/assets/firefox.svg",
      safari: "site/assets/safari.svg",
    },
    fontSizes: {
      title: 56,
      description: 26,
      statusLabel: 28,
      statusDetail: 21,
      supportName: 21,
      supportDetail: 18,
    },
    themes: {
      high: {
        accent: "#34a853",
        accentBackground: "#e6f4ea",
        accentBorder: "#b7dfc0",
      },
      low: {
        accent: "#1a73e8",
        accentBackground: "#e8f0fe",
        accentBorder: "#c8dafb",
      },
      limited: {
        accent: "#f09409",
        accentBackground: "#fff4e0",
        accentBorder: "#f6c982",
      },
      discouraged: {
        accent: "#c5221f",
        accentBackground: "#fce8e6",
        accentBorder: "#f4c7c3",
      },
    },
    strings: {
      defaultTitle: "Stay up-to-date with the web platform",
      defaultDescription:
        "Discover new features and APIs and stay up-to-date with changes across the web platform.",
      defaultStatus: {
        label: "Web platform data",
        detail: "Baseline status, browser support, specs, and developer signals.",
        icon: "https://web-platform-dx.github.io/assets/img/baseline-widely-icon.svg",
      },
      status: {
        high: {
          label: "Baseline Widely Available",
          detailPrefix: "Since ",
          icon: "https://web-platform-dx.github.io/assets/img/baseline-widely-icon.svg",
        },
        low: {
          label: "Baseline Newly Available",
          detailPrefix: "Since ",
          icon: "https://web-platform-dx.github.io/assets/img/baseline-newly-icon.svg",
        },
        limited: {
          label: "Limited availability",
          detail: "Not yet supported across all core browsers.",
          icon: "https://web-platform-dx.github.io/assets/img/baseline-limited-icon.svg",
        },
        discouraged: {
          label: "Discouraged",
          detail: "Avoid using in new code.",
          fallbackDetail: "This feature is discouraged.",
        },
      },
      support: {
        noSupport: "No support",
        versionPrefix: "v",
      },
    },
  },
  mostWantedFeatures: {
    minimumVotes: 5
  },
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
