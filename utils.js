import specs from "browser-specs" with { type: "json" };
import { BASELINE_LOW_TO_HIGH_DURATION } from "./consts.js";

export function getAllBCDKeys(bcd) {
  function walk(root, acc, keyPrefix = "") {
    for (const key in root) {
      if (!keyPrefix && (key === "__meta" || key === "browsers" || key === "webextensions")) {
        continue;
      }

      if (key === "__compat") {
        acc.push({ key: keyPrefix, status: root[key].status });
      }

      if (key !== "__compat" && typeof root[key] === "object") {
        const bcdKey = keyPrefix ? `${keyPrefix}.${key}` : key;
        walk(root[key], acc, bcdKey);
      }
    }
  }

  const keys = [];
  walk(bcd, keys);

  return keys;
}

export function stripLessThan(dateStr) {
  if (dateStr.startsWith("≤")) {
    return dateStr.substring(1);
  }
  return dateStr;
}

export function getBrowserVersionReleaseDate(browser, version) {
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

export function getAugmentedSpecData(featureSpecs) {
  const augmentedSpecData = featureSpecs.map(spec => {
    if (!spec) {
      return null;
    }

    const fragment = spec.includes("#") ? spec.split("#")[1] : null;

    // Look for the spec URL in the browser-specs data.
    const specData = specs.find(specData => {
      return (
        specData.url === spec ||
        spec.startsWith(specData.url) ||
        (specData.nightly && spec.startsWith(specData.nightly.url))
      );
    });

    return specData ? { ...specData, url: spec, fragment } : { url: spec };
  }).filter(spec => !!spec);

  return augmentedSpecData;
}

export function getExpectedBaselineHighDate(feature) {
  // If the feature is baseline low, then we expect it to become baseline high
  // at baselineLowDate + BASELINE_LOW_TO_HIGH_DURATION.
  const baselineLowDate = feature.baselineLowDateAsObject;
  if (!baselineLowDate) {
    return null;
  }

  const expectedBaselineHighDate = new Date(baselineLowDate);
  expectedBaselineHighDate.setMonth(
    expectedBaselineHighDate.getMonth() + BASELINE_LOW_TO_HIGH_DURATION
  );

  return expectedBaselineHighDate;
}

export function nameAsHTML(name) {
  // Escape HTML angle brackets.
  name = name.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // If there are backticks, convert to <code> tags.
  if (name.includes("`")) {
    const parts = name.split("`");
    name = parts
      .map((part, index) => {
        return index % 2 === 1 ? `<code>${part}</code>` : part;
      })
      .join("");
  }

  return name;
}
