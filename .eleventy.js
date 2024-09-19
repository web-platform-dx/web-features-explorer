import { EleventyHtmlBasePlugin } from "@11ty/eleventy";
import feedPlugin from "@11ty/eleventy-plugin-rss";
import { browsers, features, groups } from "web-features";
import bcd from '@mdn/browser-compat-data' assert { type: 'json' };
import specs from "browser-specs" assert { type: 'json' };

const BROWSER_BUG_TRACKERS = {
  chrome: "issues.chromium.org",
  chrome_android: "issues.chromium.org",
  edge: "issues.chromium.org",
  firefox: "bugzilla.mozilla.org",
  firefox_android: "bugzilla.mozilla.org",
  safari: "bugs.webkit.org",
  safari_ios: "bugs.webkit.org",
};

const MDN_URL_ROOT = "https://developer.mozilla.org/docs/web/";

function processMdnPath(path, area) {
  if (area === "api") {
    return path.replace(/\//g, ".");
  }

  if (area === "html") {
    if (path.startsWith("Global_attributes/")) {
      return path.substring("Global_attributes/".length) + " global attribute";
    }

    if (path.startsWith("Element/")) {
      const attribute = path.includes("#")
        ? path.substring(path.indexOf("#") + 1)
        : null;
      if (attribute) {
        return `<${path.substring(
          "Element/".length,
          path.indexOf("#")
        )} ${attribute}> attribute`;
      } else {
        return `<${path.substring("Element/".length)}> element`;
      }
    }

    if (
      path.toLowerCase().startsWith("attributes/") &&
      path.split("/").length === 3
    ) {
      const [_, attr, value] = path.split("/");
      return `${attr}="${value}" attribute`;
    }
  }

  if (area === "css") {
    if (path.startsWith("color_value/")) {
      return `${path.substring("color_value/".length)} color value`;
    } else if (path.startsWith("gradient/")) {
      return `${path.substring("gradient/".length)}() gradient function`;
    } else if (path.startsWith("::")) {
      return `${path} pseudo-element`;
    } else if (path.startsWith(":")) {
      return `${path} pseudo-class`;
    } else if (path.startsWith("transform-function/")) {
      return `${path.substring("transform-function/".length)}() function`;
    } else if (path.includes("#")) {
      const [property, value] = path.split("#");
      return `${property}: ${value}; declaration`;
    } else {
      return `${path} property`;
    }
  }

  if (area === "javascript") {
    if (path.toLowerCase().startsWith("reference/global_objects/")) {
      const object = path.substring("reference/global_objects/".length);
      if (object.includes("/")) {
        return object.replace(/\//g, ".");
      } else {
        return `${object} global object`;
      }
    }

    if (path.toLowerCase().startsWith("reference/operators/")) {
      return `${path.substring("reference/operators/".length)} operator`;
    }

    if (path.toLowerCase().startsWith("reference/statements/")) {
      return `${path.substring("reference/statements/".length)} statement`;
    }
  }

  return path;
}

function processMdnUrl(url) {
  let path = url.substring(MDN_URL_ROOT.length);
  const area = path.split("/")[0].toLowerCase();
  path = path.substring(area.length + 1);
  const title = processMdnPath(path, area);
  return { title, url, area };
}

function augmentFeatureData(id, feature) {
  // Add the id.
  feature.id = id;

  // Make groups always an array.
  if (!feature.group) {
    feature.group = [];
  } else if (!Array.isArray(feature.group)) {
    feature.group = [feature.group];
  }

  // Make the spec always an array.
  if (!feature.spec) {
    feature.spec = [];
  } else if (!Array.isArray(feature.spec)) {
    feature.spec = [feature.spec];
  }

  // Add spec data.
  feature.spec = feature.spec.map((spec) => {
    // Look for the spec URL in the browser-specs data.
    const specData = specs.find((specData) => specData.url === spec);
    return specData || { url: spec };
  });

  // Collect the first part of each BCD key in this feature (e.g. css, html, api, etc.)
  // The first part is used to display tags on feature cards
  const bcdTags = [];

  const bcdKeysData = (feature.compat_features || [])
    .map((key) => {
      // Find the BCD entry for this key.
      const keyParts = key.split(".");
      bcdTags.push(keyParts[0] === "javascript" ? "js" : keyParts[0]);

      let data = bcd;
      for (const part of keyParts) {
        if (!data || !data[part]) {
          console.warn(
            `No BCD data for ${key}. Check if the web-features and browser-compat-data dependencies are in sync.`
          );
          return null;
        }
        data = data[part];
      }

      return data && data.__compat ? { key, compat: data.__compat } : null;
    })
    .filter((data) => !!data);

  // Add MDN doc links, if any.
  const mdnUrls = {};
  let hasMdnUrls = false;
  for (const { compat } of bcdKeysData) {
    if (compat.mdn_url) {
      const urlData = processMdnUrl(compat.mdn_url);
      if (!mdnUrls[urlData.area]) {
        mdnUrls[urlData.area] = [];
      }
      hasMdnUrls = true;
      mdnUrls[urlData.area].push(urlData);
    }
  }

  feature.mdnUrls = mdnUrls;
  feature.hasMdnUrls = hasMdnUrls;

  // Add the BCD data to the feature.
  feature.bcdData = bcdKeysData;
  feature.bcdTags = [...new Set(bcdTags)];

  // Add impl_url links, if any, per browser.
  const browserImplUrls = Object.keys(browsers).reduce((acc, browserId) => {
    acc[browserId] = [];
    return acc;
  }, {});

  for (const { compat } of bcdKeysData) {
    for (const browserId in browsers) {
      const browserSupport = compat.support[browserId];
      if (!browserSupport.version_added && browserSupport.impl_url) {
        browserImplUrls[browserId] = [
          ...new Set([...browserImplUrls[browserId], browserSupport.impl_url]),
        ];
      }
    }
  }

  feature.implUrls = browserImplUrls;
}

// Massage the web-features data so it's more directly useful in our 11ty templates.
for (const id in features) {
  const feature = features[id];
  augmentFeatureData(id, feature);
}

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);
  eleventyConfig.addPassthroughCopy("site/assets");
  eleventyConfig.addShortcode(
    "browserVersionRelease",
    function (browser, version) {
      const isBeforeThan = version.startsWith("≤");
      const cleanVersion = isBeforeThan ? version.substring(1) : version;
      const date = browser.releases.find(release => release.version === cleanVersion).date;
      return isBeforeThan ? `Released before ${date}` : `Released on ${date}`;
    }
  );

  eleventyConfig.addShortcode("baselineDate", function (dateStr) {
    const isBefore = dateStr.startsWith("≤");
    if (isBefore) {
      return `before ${dateStr.substring(1)}`;
    }
    return dateStr;
  });

  eleventyConfig.addGlobalData("versions", async () => {
    const { default: webFeaturesPackageJson } = await import(
      "./node_modules/web-features/package.json",
      {
        assert: { type: "json" },
      }
    );

    return {
      date: new Date().toLocaleDateString(),
      webFeatures: webFeaturesPackageJson.version,
      bcd: bcd.__meta.version,
    };
  });

  eleventyConfig.addGlobalData("browsers", () => {
    return Object.keys(browsers).map(browserId => {
      return {
        id: browserId,
        name: browsers[browserId].name,
        releases: browsers[browserId].releases,
        bugTracker: BROWSER_BUG_TRACKERS[browserId],
      };
    });
  });

  eleventyConfig.addGlobalData("perGroup", () => {
    return groups;
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

      if (dateStr.startsWith("≤")) {
        dateStr = dateStr.substring(1);
      }

      return dateStr.substring(0, 7);
    }

    const getBaselineHighMonth = (feature) => {
      return getMonth(feature.status.baseline_high_date);
    };

    const getBaselineLowMonth = (feature) => {
      return getMonth(feature.status.baseline_low_date);
    };

    const getBrowserSupportMonth = (feature, browserId) => {
      const versionSupported = feature.status.support[browserId];
      const releaseData = browsers[browserId].releases;

      if (!versionSupported || !releaseData[versionSupported]) {
        return null;
      }

      return getMonth(releaseData[versionSupported].release_date);
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
            monthly.get(browserSupportMonth)[browser].push(feature);
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
        const isCurrentMonth = absoluteDate.getMonth() === now.getMonth() && absoluteDate.getFullYear() === now.getFullYear();
        return {
          date: new Date(month[0]).toLocaleDateString("en-us", {
            month: "long",
            year: "numeric",
          }),
          absoluteDate: absoluteDate,
          // current month is not stable because it is still updating
          // RSS feed should not include the current month
          // https://github.com/web-platform-dx/web-features-explorer/pull/23
          isStableMonth: !isCurrentMonth,
          all: [...month[1].all],
          features: month[1],
        };
      });
  });

  eleventyConfig.addGlobalData("allFeatures", () => {
    const all = [];

    for (const id in features) {
      const feature = features[id];
      all.push(feature);
    }

    return all;
  });

  eleventyConfig.addGlobalData("baselineFeatures", () => {
    const baseline = [];

    for (const id in features) {
      const feature = features[id];

      // Baseline features only.
      if (feature.status.baseline === "high") {
        baseline.push(feature);
      }
    }

    return baseline.sort((a, b) => {
      // Sort by baseline_high_date, descending, so the most recent is first.
      return (
        new Date(b.status.baseline_high_date) -
        new Date(a.status.baseline_high_date)
      );
    });
  });

  eleventyConfig.addGlobalData("nonBaselineFeatures", () => {
    const nonBaseline = [];

    for (const id in features) {
      const feature = features[id];

      // Non-baseline features only.
      if (!feature.status.baseline) {
        nonBaseline.push(feature);
      }
    }

    return nonBaseline;
  });

  eleventyConfig.addGlobalData("recentBaselineFeatures", () => {
    const recentBaseline = [];

    for (const id in features) {
      const feature = features[id];

      // Only baseline low.
      if (feature.status.baseline === "low") {
        recentBaseline.push(feature);
      }
    }

    return recentBaseline.sort((a, b) => {
      // Sort by baseline_low_date, descending, so the most recent is first.
      return (
        new Date(b.status.baseline_low_date) -
        new Date(a.status.baseline_low_date)
      );
    });
  });

  eleventyConfig.addGlobalData("missingOneBrowserFeatures", () => {
    const missingOne = [];

    for (const id in features) {
      const feature = features[id];

      // Only non-baseline features.
      if (!feature.status.baseline) {
        // And, out of those, only those that are missing support in just one browser (engine).
        const noSupport = [];
        for (const browserId in browsers) {
          if (!feature.status.support[browserId]) {
            noSupport.push(browserId);
          }
        }

        if (noSupport.length === 1) {
          missingOne.push(feature);
        }

        if (noSupport.length === 2) {
          // If one of the two values is a substring of the other, then these are the same engine.
          const [first, second] = noSupport;
          if (first.includes(second) || second.includes(first)) {
            missingOne.push(feature);
          }
        }
      }
    }

    return missingOne;
  });

  // RSS Feed Plugin
  eleventyConfig.addPlugin(feedPlugin);
  eleventyConfig.addLiquidFilter("dateToRfc3339", feedPlugin.dateToRfc3339);

  return {
    dir: {
      input: "site",
      output: "docs",
    },
    pathPrefix: "/web-features-explorer/",
  };
};
