import { EleventyHtmlBasePlugin } from "@11ty/eleventy";
import feedPlugin, { dateToRfc3339 } from "@11ty/eleventy-plugin-rss";
import fs from "node:fs/promises";
import YAML from 'yaml';
import { browsers, features as initialFeatures, groups } from "web-features";
import bcd from "@mdn/browser-compat-data" with { type: "json" };

import { getAllBCDKeys, stripLessThan, getBrowserVersionReleaseDate, getAugmentedSpecData, getExpectedBaselineHighDate, nameAsHTML } from "./utils.js";
import { BROWSERS_BY_ENGINE, WEB_FEATURES_MAPPINGS_URL } from "./consts.js";
import siteConfig from "./site.config.js";

const inlineSvgCache = new Map();

function resolveSvgPath(src) {
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }

  if (src.startsWith("/")) {
    return new URL(`./site${src}`, import.meta.url);
  }

  return new URL(src, import.meta.url);
}

async function fetchSvg(src) {
  const response = await fetch(src);

  if (!response.ok) {
    throw new Error(`Failed to fetch SVG ${src}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function readSvg(src, svgPath) {
  return typeof svgPath === "string"
    ? fetchSvg(src)
    : fs.readFile(svgPath, "utf8");
}

async function getSvgContent(src) {
  const svgPath = resolveSvgPath(src);
  const cacheKey = svgPath.toString();

  if (!inlineSvgCache.has(cacheKey)) {
    const svgContentPromise = (async () => {
      try {
        const svg = await readSvg(src, svgPath);

        if (!svg.trimStart().startsWith("<svg")) {
          throw new Error(`Expected ${src} to contain an SVG`);
        }

        return svg;
      } catch (error) {
        inlineSvgCache.delete(cacheKey);
        throw error;
      }
    })();

    inlineSvgCache.set(cacheKey, svgContentPromise);
  }

  return inlineSvgCache.get(cacheKey);
}

function addSvgAttributes(svg, attributes = {}) {
  const renderedAttributes = Object.entries(attributes)
    .filter(([, value]) => value != null && value !== "")
    .map(([name, value]) => `${name}="${String(value).replaceAll('"', "&quot;")}"`)
    .join(" ");

  if (!renderedAttributes) {
    return svg;
  }

  return svg.replace("<svg", `<svg ${renderedAttributes}`);
}

function augmentFeatureData(feature, webFeaturesMappingsData) {
  // Rename group and spec to group*s* and spec*s*, since they're always arrays.
  feature.groups = feature.group || [];
  feature.specs = feature.spec || [];

  // Add more data about the specs, by using the browser-specs package, when possible.
  feature.specs = getAugmentedSpecData(feature.specs);
  
  // Augment the feature object with the additional data from web-features-mappings.
  const featureMappings = webFeaturesMappingsData[feature.id] || {};
  feature.mdnUrls = featureMappings["mdn-docs"] || [];
  feature.standardPositions = featureMappings["standards-positions"] || [];
  feature.hasNegativeStandardPosition = feature.standardPositions.some(pos => {
    return pos.position === "negative" || pos.position === "oppose";
  });
  feature.stateOfSurveys = featureMappings["state-of-surveys"] || [];
  feature.chromeUseCounters = featureMappings["chrome-use-counters"] || {};
  feature.interop = featureMappings["interop"]|| [];
  feature.wpt = featureMappings["wpt"] || null;
  feature.developerSignals = featureMappings["developer-signals"] || null;
  feature.bugs = featureMappings["bugs"] || {};
  feature.useCases = featureMappings["use-cases"] || null;

  // Add the baseline low and high dates as JS objects, so that templates
  // can format them as needed.
  feature.baselineLowDateAsObject = feature.status.baseline
    ? new Date(stripLessThan(feature.status.baseline_low_date))
    : null;
  feature.baselineHighDateAsObject = feature.status.baseline && feature.status.baseline === "high"
    ? new Date(stripLessThan(feature.status.baseline_high_date))
    : null;

  // Add expected baseline high date, if applicable.
  if (feature.status.baseline === "low") {
    const expectedHighDate = getExpectedBaselineHighDate(feature);
    feature.expectedBaselineHighDate = expectedHighDate ? expectedHighDate.toISOString().substring(0, 10) : null;
  }
}

function addBlockedByEngineMetadata(feature) {
  // Baseline features are not blocked by definition.
  if (feature.status.baseline) {
    return;
  }

  const missingEngines = [];
  for (const engineData of BROWSERS_BY_ENGINE) {
    const hasFullSupportInEngine = engineData.browers.every((browserId) => {
      return !!feature.status.support[browserId];
    });

    if (!hasFullSupportInEngine) {
      missingEngines.push(engineData.name);
    }
  }

  // Keep only features that are missing in exactly one engine.
  if (missingEngines.length !== 1) {
    return;
  }

  let mostRecent = null;
  for (const browserId in feature.status.support) {
    let versionSupported = feature.status.support[browserId];
    if (!versionSupported) {
      continue;
    }

    versionSupported = stripLessThan(versionSupported);
    const releaseDateStr = bcd.browsers[browserId]?.releases[versionSupported]?.release_date;
    if (!releaseDateStr) {
      continue;
    }

    const releaseDate = new Date(releaseDateStr);
    if (!mostRecent || releaseDate > mostRecent) {
      mostRecent = releaseDate;
    }
  }

  if (!mostRecent) {
    return;
  }

  const today = new Date();
  const formatter = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
  });

  feature.blockedOn = missingEngines[0];
  feature.blockedSince = formatter.format(mostRecent);
  feature.monthsBlocked =
    (today.getFullYear() - mostRecent.getFullYear()) * 12 +
    (today.getMonth() - mostRecent.getMonth());
}

function getMissingOnlyInOneEngineData(features, browsers) {
  const missingOnlyInOneEngine = Object.fromEntries(
    BROWSERS_BY_ENGINE.map((engineData) => [engineData.name, []])
  );

  for (const id in features) {
    const feature = features[id];
    const support = feature.status.support;
    const missingEngines = [];

    for (const engineData of BROWSERS_BY_ENGINE) {
      const hasFullSupportInEngine = engineData.browers.every((browserId) => {
        return !!support[browserId];
      });

      if (!hasFullSupportInEngine) {
        missingEngines.push(engineData.name);
      }
    }

    // Keep only features that are missing in exactly one engine.
    if (missingEngines.length === 1) {
      missingOnlyInOneEngine[missingEngines[0]].push(feature);
    }
  }

  return missingOnlyInOneEngine;
}

function getOnlyInOneEngineData(features) {
  const onlyInOneEngine = Object.fromEntries(
    BROWSERS_BY_ENGINE.map((engineData) => [engineData.name, []])
  );

  for (const id in features) {
    const feature = features[id];
    const support = feature.status.support;

    const enginesWithSupport = [];
    for (const engineData of BROWSERS_BY_ENGINE) {
      const hasSupportInEngine = engineData.browers.some((browserId) => {
        return !!support[browserId];
      });

      if (hasSupportInEngine) {
        enginesWithSupport.push(engineData.name);
      }
    }

    if (enginesWithSupport.length === 1) {
      onlyInOneEngine[enginesWithSupport[0]].push(feature);
    }
  }

  return onlyInOneEngine;
}

export default async function (eleventyConfig) {
  // Retrieve the web-features-mappings data.
  const response = await fetch(WEB_FEATURES_MAPPINGS_URL);
  const webFeaturesMappingsData = await response.json();

  // Massage the web-features data so it's more directly useful in our 11ty templates.
  // Here we go over the initialFeatures (from the web-features package) and split them
  // into ordinary features (kind:feature) and unordinary features (kind:split, kind:moved).
  // We also "augment" the ordinary features with additional data from various sources.
  // Unordinary features are left as-is and handled differently in the templates.
  const features = {};
  const unordinaryFeatures = {};

  for (const id in initialFeatures) {
    const feature = initialFeatures[id];

    // Add the id to the feature object.
    feature.id = id;

    // Only add our custom data to each feature for ordinary features.
    if (feature.kind === "feature") {
      await augmentFeatureData(feature, webFeaturesMappingsData);
      addBlockedByEngineMetadata(feature);

      // Store the newly augmented feature data.
      features[id] = feature;
    } else {
      // Store unordinary features separately.
      unordinaryFeatures[id] = feature;
    }
  }

  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);
  eleventyConfig.addPlugin(feedPlugin);

  eleventyConfig.addLiquidFilter("dateToRfc3339", dateToRfc3339);

  eleventyConfig.addFilter("prettyUrlForAdditionalDiscouragedInfo", function(value) {
    const ghPrefix = "https://github.com/";
    const w3cPrefix = "https://www.w3.org/";
    const csswgDraftPrefix = "https://drafts.csswg.org/";
    const htmlSpecPrefix = "https://html.spec.whatwg.org/multipage/";

    if (value.startsWith(ghPrefix)) {
      return value.substring(ghPrefix.length) + " (GitHub)";
    }

    if (value.startsWith(w3cPrefix)) {
      return value.substring(w3cPrefix.length) + " (W3C)";
    }

    if (value.startsWith(csswgDraftPrefix)) {
      return value.substring(csswgDraftPrefix.length) + " (CSSWG draft)";
    }

    if (value.startsWith(htmlSpecPrefix)) {
      return value.substring(htmlSpecPrefix.length) + " (HTML spec)";
    }

    return value;
  })

  eleventyConfig.addPassthroughCopy("site/assets");
  eleventyConfig.addPassthroughCopy({ "node_modules/apexcharts/dist/apexcharts.css": "assets/apexcharts.css" });
  eleventyConfig.addPassthroughCopy({ "node_modules/apexcharts/dist/apexcharts.min.js": "assets/apexcharts.js" });
  eleventyConfig.setServerPassthroughCopyBehavior("passthrough");

  // CSS files are served as static assets; avoid full template rebuilds on every style tweak.
  eleventyConfig.watchIgnores.add("./site/assets/**/*.css");

  eleventyConfig.addDataExtension("yml,yaml", (contents, filePath) => {
    return YAML.parse(contents);
  });

  eleventyConfig.addShortcode(
    "browserVersionRelease",
    function (browser, version) {
      const { isBeforeThan, date } = getBrowserVersionReleaseDate(browser, version);
      return isBeforeThan ? `Released before ${date}` : `Released on ${date}`;
    }
  );

  eleventyConfig.addShortcode("nameAsHTML", nameAsHTML);

  eleventyConfig.addNunjucksAsyncShortcode("inlineSvg", async function (src, className) {
    const svg = await getSvgContent(src);

    return addSvgAttributes(svg, {
      class: className,
      "aria-hidden": "true",
      focusable: "false",
    });
  });

  eleventyConfig.addShortcode("escapeJSON", function (name) {
    return name.replace(/"/g, "\\\"");
  });

  eleventyConfig.addShortcode("baselineDate", function (dateStr) {
    const isBefore = dateStr.startsWith("≤");
    if (isBefore) {
      return `before ${dateStr.substring(1)}`;
    }
    return dateStr;
  });

  eleventyConfig.addShortcode("useCounterPercentage", function (value) {
    return `~${(value * 100).toFixed(3)}%`;
  });

  eleventyConfig.addFilter("stringify", (data) => {
    return JSON.stringify(data, null, " ", 2)
  })

  eleventyConfig.addFilter("extractBugNumber", bugUrl => {
    if (!bugUrl) {
      return "";
    }

    const match = bugUrl.match(/\/(\d+)$/);
    return match ? match[1] : "";
  });

  eleventyConfig.addFilter("formatNumber", (value, fallback = siteConfig.strings.formatting.missingValue) => {
    return value === null || value === undefined
      ? fallback
      : value.toLocaleString("en-US");
  });

  eleventyConfig.addFilter("formatPercent", (value, fallback = siteConfig.strings.formatting.missingValue) => {
    return value === null || value === undefined
      ? fallback
      : `${value.toFixed(2)}%`;
  });

  eleventyConfig.addGlobalData("siteConfig", () => siteConfig);

  eleventyConfig.addGlobalData("versions", async () => {
    const { default: webFeaturesPackageJson } = await import(
      "./node_modules/web-features/package.json",
      {
        with: { type: "json" },
      }
    );

    return {
      date: new Date().toLocaleDateString(),
      webFeatures: webFeaturesPackageJson.version,
      bcd: bcd.__meta.version,
    };
  });

  eleventyConfig.addGlobalData("statistics", async () => {
    return JSON.parse(
      await fs.readFile(new URL("./site/assets/statistics.json", import.meta.url)),
    );
  });

  eleventyConfig.addGlobalData("browsers", () => {
    return Object.keys(browsers).map((browserId) => {
      return {
        id: browserId,
        name: browsers[browserId].name,
        releases: browsers[browserId].releases.map(release => {
          // Add the status of the release from BCD (current, retired, beta, nightly).
          release.status = bcd.browsers[browserId].releases[release.version].status;
          return release;
        })
      };
    });
  });

  eleventyConfig.addGlobalData("perGroup", () => {
    return groups;
  });

  eleventyConfig.addGlobalData("latest", () => {
    const maxLowFeatures = 5;
    const lowFeatures = [];
    const maxHighFeatures = 5;
    const highFeatures = [];

    for (const id in features) {
      const feature = features[id];

      if (feature.status.baseline === "low") {
        lowFeatures.push(feature);
      }

      if (feature.status.baseline === "high") {
        highFeatures.push(feature);
      }
    }

    return {
      latestBaselineLow: lowFeatures.sort((a, b) => {
        return (
          new Date(b.status.baseline_low_date) -
          new Date(a.status.baseline_low_date)
        );
      }).slice(0, maxLowFeatures),
      latestBaselineHigh: highFeatures.sort((a, b) => {
        return (
          new Date(b.status.baseline_high_date) -
          new Date(a.status.baseline_high_date)
        );
      }).slice(0, maxHighFeatures)
    };
  });

  eleventyConfig.addGlobalData("perMonth", () => {
    const monthly = new Map();

    const ensureMonthEntry = (month) => {
      if (!monthly.has(month)) {
        const obj = { high: [], low: [], all: new Set() };
        for (const browserId in browsers) {
          obj[browserId] = [];
        }

        monthly.set(month, obj);
      }
    };

    const getMonth = (dateStr) => {
      if (!dateStr) {
        return null;
      }

      return stripLessThan(dateStr).substring(0, 7);
    };

    const getBaselineHighMonth = (feature) => getMonth(feature.status.baseline_high_date);
    const getBaselineLowMonth = (feature) => getMonth(feature.status.baseline_low_date);

    const getBrowserSupportMonth = (feature, browserId) => {
      const versionSupported = feature.status.support[browserId];
      const releaseData = browsers[browserId].releases;

      if (!versionSupported) {
        return null;
      }

      const release = releaseData.find(r => r.version === versionSupported);
      if (!release) {
        return null;
      }

      return getMonth(release.date);
    };

    for (const id in features) {
      const feature = features[id];

      const baselineHighMonth = getBaselineHighMonth(feature);
      if (baselineHighMonth) {
        ensureMonthEntry(baselineHighMonth);
        monthly.get(baselineHighMonth).high.push(feature);
        monthly.get(baselineHighMonth).all.add(feature);
      }

      const baselineLowMonth = getBaselineLowMonth(feature);
      if (baselineLowMonth) {
        ensureMonthEntry(baselineLowMonth);
        monthly.get(baselineLowMonth).low.push(feature);
        monthly.get(baselineLowMonth).all.add(feature);
      }

      for (const browserId in browsers) {
        const browserSupportMonth = getBrowserSupportMonth(feature, browserId);
        if (browserSupportMonth) {
          ensureMonthEntry(browserSupportMonth);
          // Only record the feature if it hasn't already been recorded as baseline
          // low or high for the same month.
          const alreadyRecorded =
            monthly
              .get(browserSupportMonth)
              .high.some((f) => f.id === feature.id) ||
            monthly
              .get(browserSupportMonth)
              .low.some((f) => f.id === feature.id);
          if (!alreadyRecorded) {
            monthly.get(browserSupportMonth)[browserId].push(feature);
            monthly.get(browserSupportMonth).all.add(feature);
          }
        }
      }
    }

    const now = new Date();
    return [...monthly]
      .sort((a, b) => {
        return new Date(b[0]) - new Date(a[0]);
      })
      .map((month) => {
        const absoluteDate = new Date(month[0]);
        const isCurrentMonth =
          absoluteDate.getMonth() === now.getMonth() &&
          absoluteDate.getFullYear() === now.getFullYear();
        return {
          date: new Date(month[0]).toLocaleDateString("en-us", {
            month: "long",
            year: "numeric",
          }),
          absoluteDate,
          // current month is not stable because it is still updating
          // RSS feed should not include the current month
          // https://github.com/web-platform-dx/web-features-explorer/pull/23
          isStableMonth: !isCurrentMonth,
          all: [...month[1].all],
          features: month[1],
        };
      });
  });

  eleventyConfig.addGlobalData("allFeaturesAsObject", () => {
    return features;
  });

  eleventyConfig.addGlobalData("allFeatures", () => {
    const all = [];

    for (const id in features) {
      const feature = features[id];
      all.push(feature);
    }

    return all;
  });

  eleventyConfig.addGlobalData("allUnordinaryFeatures", () => {
    const all = [];

    for (const id in unordinaryFeatures) {
      const feature = unordinaryFeatures[id];
      all.push(feature);
    }

    return all;
  });

  eleventyConfig.addGlobalData("allFeaturesAsJSON", () => {
    const all = [];

    for (const id in features) {
      const feature = features[id];
      all.push({
        description_html: feature.description_html,
        id: feature.id,
        name: feature.name,
        status: feature.status,
      });
    }

    return JSON.stringify(all);
  });

  eleventyConfig.addGlobalData("widelyAvailableFeatures", () => {
    const widelyAvailable = [];

    for (const id in features) {
      const feature = features[id];

      // Baseline features only.
      if (feature.status.baseline === "high") {
        widelyAvailable.push(feature);
      }
    }

    return widelyAvailable.sort((a, b) => {
      // Sort by baseline_high_date, descending, so the most recent is first.
      return (
        new Date(b.status.baseline_high_date) -
        new Date(a.status.baseline_high_date)
      );
    });
  });

  eleventyConfig.addGlobalData("limitedAvailabilityFeatures", () => {
    const limitedAvailability = [];

    for (const id in features) {
      const feature = features[id];

      // Non-baseline features only that are also not discouraged.
      if (!feature.status.baseline && !feature.discouraged) {
        limitedAvailability.push(feature);
      }
    }

    // Sort the features by date, with the most recently updated 
    // feature first, irrespective of which browser it was updated for.
    return limitedAvailability.sort((a, b) => {
      let maxADate = 0;
      let maxBDate = 0;

      // Get all of the browser release dates for the compared features
      // and get the most recent.
      for (const browserId in browsers) {
        const aVersion = a.status.support[browserId];
        if (aVersion) {
          const date = new Date(getBrowserVersionReleaseDate(browsers[browserId], aVersion).date);
          maxADate = Math.max(maxADate, date.getTime());
        }
        const bVersion = b.status.support[browserId];
        if (bVersion) {
          const date = new Date(getBrowserVersionReleaseDate(browsers[browserId], bVersion).date);
          maxBDate = Math.max(maxBDate, date.getTime());
        }
      }

      return maxBDate - maxADate;
    });
  });

  eleventyConfig.addGlobalData("mostWantedFeatures", () => {
    const mostWanted = [];

    for (const id in features) {
      const feature = features[id];

      // Only features that are not baseline low/high.
      if (feature.status.baseline) {
        continue;
      }

      const votes = Number(feature.developerSignals?.votes || 0);
      if (votes < siteConfig.mostWantedFeatures.minimumVotes) {
        continue;
      }

      mostWanted.push(feature);
    }

    return mostWanted.sort((a, b) => {
      return Number(b.developerSignals?.votes || 0) - Number(a.developerSignals?.votes || 0);
    });
  });

  eleventyConfig.addGlobalData("newlyAvailableFeatures", () => {
    const newlyAvailable = [];

    for (const id in features) {
      const feature = features[id];

      // Only baseline low.
      if (feature.status.baseline === "low") {
        newlyAvailable.push(feature);
      }
    }

    return newlyAvailable.sort((a, b) => {
      // Sort by baseline_low_date, descending, so the most recent is first.
      return (
        new Date(b.status.baseline_low_date) -
        new Date(a.status.baseline_low_date)
      );
    });
  });

  eleventyConfig.addGlobalData("bcdMapping", () => {
    const mapped = [];
    for (const id in features) {
      const feature = features[id];
      if (feature.compat_features && feature.compat_features.length) {
        mapped.push(...feature.compat_features);
      }
    }

    const unmapped = [];
    let lastKeyContext = null;
    getAllBCDKeys(bcd).forEach(({ key, status }) => {
      if (!mapped.includes(key)) {
        const keyContent = key.split(".").slice(0, 2).join(".");
        unmapped.push({ key, status, isNewGroup: keyContent !== lastKeyContext });
        lastKeyContext = keyContent;
      }
    });

    return {
      totalKeys: mapped.length + unmapped.length,
      totalMapped: mapped.length,
      unmapped,
      percentage: ((mapped.length / (mapped.length + unmapped.length)) * 100).toFixed(0),
    };
  });

  eleventyConfig.addGlobalData("onlyInOneEngine", () => {
    return getOnlyInOneEngineData(features);
  });

  eleventyConfig.addGlobalData("onlyInOneEngineList", () => {
    const perEngine = getOnlyInOneEngineData(features);
    return Object.keys(perEngine).map((engineName) => {
      return {
        name: engineName,
        features: perEngine[engineName],
      };
    });
  });

  eleventyConfig.addGlobalData("missingOnlyInOneEngine", () => {
    return getMissingOnlyInOneEngineData(features, browsers);
  });

  eleventyConfig.addGlobalData("missingOnlyInOneEngineList", () => {
    const perEngine = getMissingOnlyInOneEngineData(features, browsers);
    return Object.keys(perEngine).map((engineName) => {
      return {
        name: engineName,
        features: perEngine[engineName],
      };
    });
  });

  return {
    dir: {
      input: "site",
      output: "docs",
    },
    pathPrefix: "/web-features-explorer/",
  };
}
