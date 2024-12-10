import { EleventyHtmlBasePlugin } from "@11ty/eleventy";
import feedPlugin from "@11ty/eleventy-plugin-rss";
import YAML from 'yaml';
import { browsers, features, groups } from "web-features";
import bcd from "@mdn/browser-compat-data" with { type: "json" };
import specs from "browser-specs" with { type: "json" };
import mdnInventory from "@ddbeck/mdn-content-inventory";
import mdnDocsOverrides from "./mdnDocsOverrides.json" with { type: "json" };
import standardPositions from "./standard-positions.json" with { type: "json" };

const BROWSER_BUG_TRACKERS = {
  chrome: "issues.chromium.org",
  chrome_android: "issues.chromium.org",
  edge: "issues.chromium.org",
  firefox: "bugzilla.mozilla.org",
  firefox_android: "bugzilla.mozilla.org",
  safari: "bugs.webkit.org",
  safari_ios: "bugs.webkit.org",
};

const MDN_URL_ROOT = "https://developer.mozilla.org/docs/";

function findParentGroupId(group) {
  if (!group.parent) {
    return null;
  }

  return group.parent;
}

function augmentFeatureData(id, feature) {
  // Add the id.
  feature.id = id;

  // Make groups always an array.
  feature.groups = [];
  if (feature.group && !Array.isArray(feature.group)) {
    feature.groups = [feature.group];
  } else if (feature.group) {
    feature.groups = feature.group;
  }

  // Create group paths. The groups that a feature belongs to might be
  // nested in parent groups.
  feature.groupPaths = [];
  for (const groupId of feature.groups) {
    const path = [groups[groupId].name];
    let currentGroupId = groupId;

    while (true) {
      const parentId = findParentGroupId(groups[currentGroupId]);
      if (!parentId) {
        break;
      }
      path.unshift(groups[parentId].name);
      currentGroupId = parentId;
    }
    feature.groupPaths.push(path);
  }

  // Make the spec always an array.
  if (!feature.spec) {
    feature.spec = [];
  } else if (!Array.isArray(feature.spec)) {
    feature.spec = [feature.spec];
  }

  // Add spec data from browser-specs, when possible.
  feature.spec = feature.spec.map((spec) => {
    const fragment = spec.includes("#") ? spec.split("#")[1] : null;
    // Look for the spec URL in the browser-specs data.
    const specData = specs.find((specData) => {
      return (
        specData.url === spec ||
        spec.startsWith(specData.url) ||
        (specData.nightly && spec.startsWith(specData.nightly.url))
      );
    });
    return specData ? { ...specData, url: spec, fragment } : { url: spec };
  });

  // Get the first part of each BCD key in the feature (e.g. css, javascript, html, api, ...)
  // to use as tags.
  const bcdTags = [];

  const bcdKeysData = (feature.compat_features || [])
    .map((key) => {
      // Find the BCD entry for this key.
      const keyParts = key.split(".");

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

      bcdTags.push(keyParts[0]);

      return data && data.__compat ? { key, compat: data.__compat } : null;
    })
    .filter((data) => !!data);

  // Add MDN doc links, if any.
  const mdnUrls = [];

  if (mdnDocsOverrides[id] && mdnDocsOverrides[id].length) {
    // If the feature has a doc override, use that.
    for (const slug of mdnDocsOverrides[id]) {
      const slugParts = slug.split("#");
      const hasAnchor = slugParts.length > 1;

      const mdnArticleData = mdnInventory.inventory.find((item) => {
        return item.frontmatter.slug === (hasAnchor ? slugParts[0] : slug);
      });
      if (mdnArticleData) {
        mdnUrls.push({
          title: mdnArticleData.frontmatter.title,
          anchor: hasAnchor ? slugParts[1] : null,
          url: MDN_URL_ROOT + mdnArticleData.frontmatter.slug + (hasAnchor ? `#${slugParts[1]}` : ""),
        });
      }
    }
  } else {
    // Otherwise, compute a list of MDN docs based on BCD keys.
    for (const { key, mdn_url } of bcdKeysData) {
      const mdnArticleData = mdnInventory.inventory.find((item) => {
        return item.frontmatter["browser-compat"] === key;
      });
      if (mdnArticleData) {
        mdnUrls.push({
          title: mdnArticleData.frontmatter.title,
          url: MDN_URL_ROOT + mdnArticleData.frontmatter.slug,
        });
      } else if (mdn_url) {
        mdnUrls.push({
          url: mdn_url,
          title: mdn_url,
        });
      }
    }
  }

  feature.mdnUrls = mdnUrls;

  // Add standard positions.
  feature.standardPositions = standardPositions[id];

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

function getBrowserVersionReleaseDate(browser, version) {
  const isBeforeThan = version.startsWith("≤");
  const cleanVersion = isBeforeThan ? version.substring(1) : version;
  const date = browser.releases.find(
    (release) => release.version === cleanVersion
  ).date;

  return {
    isBeforeThan,
    date
  };
}

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);

  eleventyConfig.addPassthroughCopy("site/assets");
  
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
        with: { type: "json" },
      }
    );

    return {
      date: new Date().toLocaleDateString(),
      webFeatures: webFeaturesPackageJson.version,
      bcd: bcd.__meta.version,
    };
  });

  eleventyConfig.addGlobalData("browsers", () => {
    return Object.keys(browsers).map((browserId) => {
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

      if (dateStr.startsWith("≤")) {
        dateStr = dateStr.substring(1);
      }

      return dateStr.substring(0, 7);
    };

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
        const isCurrentMonth =
          absoluteDate.getMonth() === now.getMonth() &&
          absoluteDate.getFullYear() === now.getFullYear();
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

  eleventyConfig.addGlobalData("features", () => {
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

      // Non-baseline features only.
      if (!feature.status.baseline) {
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

  eleventyConfig.addGlobalData("missingOneBrowserFeatures", () => {
    const missingOne = [];

    for (const id in features) {
      const feature = features[id];

      // Only non-baseline features.
      if (feature.status.baseline) {
        continue;
      }

      // And, out of those, only those that are missing support in just one browser (engine).
      const noSupport = [];
      for (const browserId in browsers) {
        if (!feature.status.support[browserId]) {
          noSupport.push(browserId);
        }
      }

      if (noSupport.length === 1) {
        feature.blockedOn = browsers[noSupport[0]].name;
        missingOne.push(feature);
      }

      if (noSupport.length === 2) {
        // If one of the two values is a substring of the other, then these are the same engine.
        const [first, second] = noSupport;
        if (first.includes(second) || second.includes(first)) {
          feature.blockedOn = browsers[noSupport[0]].name;
          missingOne.push(feature);
        }
      }
    }

    // Go over the features we found and add some information about the last browser
    // that doesn't yet support the feature.
    missingOne.forEach((feature) => {
      let mostRecent = null;

      const support = feature.status.support;
      for (const browserId in support) {
        let versionSupported = support[browserId];
        if (versionSupported.startsWith("≤")) {
          versionSupported = versionSupported.substring(1);
        }

        // Grab release date string from BCD as it has a more complete list of
        // browser releases than the web features data.
        const releaseDateStr =
          bcd.browsers[browserId]?.releases[versionSupported]?.release_date;

        // Some are missing
        if (!releaseDateStr) {
          continue;
        }

        const releaseDate = new Date(releaseDateStr);
        if (!mostRecent) {
          mostRecent = releaseDate;
        } else {
          if (releaseDate > mostRecent) {
            mostRecent = releaseDate;
          }
        }
      }
      const today = new Date();
      const formatter = new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "long",
      });
      const monthDiff = (older, newer) => {
        return (
          (newer.getFullYear() - older.getFullYear()) * 12 +
          (newer.getMonth() - older.getMonth())
        );
      };

      feature.monthsBlocked = monthDiff(mostRecent, today);
      feature.blockedSince = formatter.format(mostRecent);
    });

    // Sort the features by monthsBlocked, with the most recently
    // updated feature first. Most recently updated means the
    // shortest blocked time.
    return missingOne.sort((a, b) => {
      return a.monthsBlocked - b.monthsBlocked;
    });
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
}
