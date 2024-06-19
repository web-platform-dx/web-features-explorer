const { EleventyHtmlBasePlugin } = require("@11ty/eleventy");

const BROWSERS = [
  "chrome",
  "chrome_android",
  "edge",
  "firefox",
  "firefox_android",
  "safari",
  "safari_ios",
];

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

// Add more data to a feature's object, based on what our templates need.
function augmentFeatureData(id, feature, bcd) {
  // Add the id.
  feature.id = id;

  // Make the spec always an array.
  if (!feature.spec) {
    feature.spec = [];
  } else if (!Array.isArray(feature.spec)) {
    feature.spec = [feature.spec];
  }

  const bcdKeysData = (feature.compat_features || [])
    .map((key) => {
      // Find the BCD entry for this key.
      const keyParts = key.split(".");
      let data = bcd;
      for (const part of keyParts) {
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

  // Add impl_url links, if any, per browser.
  const browserImplUrls = Object.values(BROWSERS).reduce((acc, browser) => {
    acc[browser] = [];
    return acc;
  }, {});

  for (const { compat } of bcdKeysData) {
    for (const browser of BROWSERS) {
      const browserSupport = compat.support[browser];
      if (!browserSupport.version_added && browserSupport.impl_url) {
        browserImplUrls[browser] = [
          ...new Set([...browserImplUrls[browser], browserSupport.impl_url]),
        ];
      }
    }
  }

  feature.implUrls = browserImplUrls;
}

let features = null;
let bcd = null;

async function getDeps() {
  if (!features) {
    const module = await import("web-features");
    features = module.default;
  }

  if (!bcd) {
    const json = await import("@mdn/browser-compat-data", {
      assert: { type: "json" },
    });
    bcd = json.default;
  }

  return { features, bcd };
}

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);
  eleventyConfig.addPassthroughCopy("site/assets");

  eleventyConfig.addGlobalData("versions", async () => {
    const { default: webFeaturesPackageJson } = await import(
      "./node_modules/web-features/package.json",
      {
        assert: { type: "json" },
      }
    );

    const { bcd } = await getDeps();

    return {
      date: new Date().toLocaleDateString(),
      webFeatures: webFeaturesPackageJson.version,
      bcd: bcd.__meta.version,
    };
  });

  // FIXME: Ideally, web-features would have this data.
  eleventyConfig.addGlobalData("browsers", async () => {
    const { bcd } = await getDeps();

    return BROWSERS.map((browser) => {
      return {
        id: browser,
        name: bcd.browsers[browser].name,
        releases: bcd.browsers[browser].releases,
        bugTracker: BROWSER_BUG_TRACKERS[browser],
      };
    });
  });

  eleventyConfig.addGlobalData("perMonth", async () => {
    const { features, bcd } = await getDeps();

    const monthly = new Map();

    const ensureMonthEntry = (month) => {
      if (!monthly.has(month)) {
        const obj = { high: [], low: [] };
        for (const browser of BROWSERS) {
          obj[browser] = [];
        }

        monthly.set(month, obj);
      }
    };

    const getBaselineHighMonth = (feature) => {
      return (
        feature.status.baseline_high_date &&
        feature.status.baseline_high_date.substring(0, 7)
      );
    };

    const getBaselineLowMonth = (feature) => {
      return (
        feature.status.baseline_low_date &&
        feature.status.baseline_low_date.substring(0, 7)
      );
    };

    const getBrowserSupportMonth = (feature, browser) => {
      const versionSupported = feature.status.support[browser];
      const releaseData = bcd.browsers[browser].releases;

      if (!versionSupported || !releaseData[versionSupported]) {
        return null;
      }

      return releaseData[versionSupported].release_date.substring(0, 7);
    };

    for (const id in features) {
      const feature = features[id];
      augmentFeatureData(id, feature, bcd);

      const baselineHighMonth = getBaselineHighMonth(feature);
      if (baselineHighMonth) {
        ensureMonthEntry(baselineHighMonth);
        monthly.get(baselineHighMonth).high.push(feature);
      }

      const baselineLowMonth = getBaselineLowMonth(feature);
      if (baselineLowMonth) {
        ensureMonthEntry(baselineLowMonth);
        monthly.get(baselineLowMonth).low.push(feature);
      }

      for (const browser of BROWSERS) {
        const browserSupportMonth = getBrowserSupportMonth(feature, browser);
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
          }
        }
      }
    }

    return [...monthly]
      .sort((a, b) => {
        return new Date(b[0]) - new Date(a[0]);
      })
      .map((month) => {
        return {
          date: new Date(month[0]).toLocaleDateString("en-us", {
            month: "long",
            year: "numeric",
          }),
          features: month[1],
        };
      });
  });

  eleventyConfig.addGlobalData("allFeatures", async () => {
    const { features, bcd } = await getDeps();

    const all = [];

    for (const id in features) {
      const feature = features[id];
      augmentFeatureData(id, feature, bcd);
      all.push(feature);
    }

    return all;
  });

  eleventyConfig.addGlobalData("baselineFeatures", async () => {
    const { features, bcd } = await getDeps();

    const baseline = [];

    for (const id in features) {
      const feature = features[id];

      // Baseline features only.
      if (feature.status.baseline === "high") {
        augmentFeatureData(id, feature, bcd);
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

  eleventyConfig.addGlobalData("nonBaselineFeatures", async () => {
    const { features, bcd } = await getDeps();

    const nonBaseline = [];

    for (const id in features) {
      const feature = features[id];

      // Non-baseline features only.
      if (!feature.status.baseline) {
        augmentFeatureData(id, feature, bcd);
        nonBaseline.push(feature);
      }
    }

    return nonBaseline;
  });

  eleventyConfig.addGlobalData("recentBaselineFeatures", async () => {
    const { features, bcd } = await getDeps();

    const recentBaseline = [];

    for (const id in features) {
      const feature = features[id];
      augmentFeatureData(id, feature, bcd);

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

  eleventyConfig.addGlobalData("missingOneBrowserFeatures", async () => {
    const { features, bcd } = await getDeps();

    const missingOne = [];

    for (const id in features) {
      const feature = features[id];
      augmentFeatureData(id, feature, bcd);

      // Only non-baseline features.
      if (!feature.status.baseline) {
        // And, out of those, only those that are missing support in just one browser (engine).
        const noSupport = [];
        for (const browserId of BROWSERS) {
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

  return {
    dir: {
      input: "site",
      output: "docs",
    },
    pathPrefix: "/web-features-explorer/",
  };
};
