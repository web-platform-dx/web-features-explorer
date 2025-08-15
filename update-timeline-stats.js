/**
 * Process baseline data from the web-features package to create
 * data tables for visualization purpose.
 *
 * Some notes:
 * - Timeline stats do not include features that have not shipped anywhere
 * because these aren't associated with any date in web-features (32 features
 * as of January 2025).
 * - Process drops occurrences of '≤' in dates, because it's hard to deal with
 * uncertainties in stats.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { browsers } from "web-features";
import { features } from "./features.js";

const OUTPUT_TIMELINE = path.join(import.meta.dirname, "site", "assets", "timeline-number.json");
const OUTPUT_DURATIONS = path.join(import.meta.dirname, "site", "assets", "timeline-durations.json");
const FIRST_NEWLY_AVAILABLE_YEAR = "2015";

async function main() {
  // Convert features to an array and pretend all dates are exact 
  const simplifiedFeatures = Object.entries(features)
    .map(([id, feature]) => Object.assign({ id }, feature))
    .map(feature => {
      if (feature.status.baseline_low_date &&
          feature.status.baseline_low_date.startsWith("≤")) {
        feature.status.baseline_low_date = feature.status.baseline_low_date.slice(1);
        feature.simplified = true;
      }
      if (feature.status.baseline_high_date &&
          feature.status.baseline_high_date.startsWith("≤")) {
        feature.status.baseline_high_date = feature.status.baseline_high_date.slice(1);
        feature.simplified = true;
      }
      for (const [browser, version] of Object.entries(feature.status.support)) {
        if (version.startsWith("≤")) {
          feature.status.support[browser] = version.slice(1);
          feature.simplified = true;
        }
      }
      return feature;
    });

  // Compute first implementation dates and prepare full list of release dates
  let dates = new Set();
  for (const feature of simplifiedFeatures) {
    feature.status.first_implementation_date =
      Object.entries(feature.status.support)
        .map(([browser, version]) =>
          browsers[browser].releases.find(r => r.version === version))
        .map(release => release.date)
        .sort()
        .reverse()
        .pop();
    if (feature.status.baseline_high_date) {
      dates.add(feature.status.baseline_high_date);
    }
    if (feature.status.baseline_low_date) {
      dates.add(feature.status.baseline_low_date);
    }
    if (feature.status.first_implementation_date) {
      dates.add(feature.status.first_implementation_date);
    }
  }
  dates = [...dates].sort();
  const years = [...new Set(dates.map(d => d.slice(0, 4)))].sort();

  // Prepare timeline data
  let timeline = dates.map(d => Object.assign({
    date: d,
    high: [],
    low: [],
    first: []
  }));

  // Fill timeline data with features
  for (const feature of simplifiedFeatures) {
    let status = feature.status.baseline;
    if (feature.discouraged) {
      status = "discouraged";
    }
    else if (feature.status.baseline === undefined) {
      throw new Error(`${feature.name} (id: ${feature.id}) still has an undefined baseline status!`);
    }
    else if (!feature.status.baseline) {
      status = "limited";
    }

    if (feature.status.baseline_high_date) {
      timeline
        .find(t => t.date === feature.status.baseline_high_date)
        .high
        .push(feature.id);
    }
    if (feature.status.baseline_low_date) {
      timeline
        .find(t => t.date === feature.status.baseline_low_date)
        .low
        .push(feature.id);
    }
    if (feature.status.first_implementation_date) {
      timeline
        .find(t => t.date === feature.status.first_implementation_date)
        .first
        .push(feature.id);
    }
  }

  // Each time in the timeline contains features that shipped, became newly
  // or widely available, at that time. To visualize the overall growth of
  // the platform in terms of number of features over time, let's compile a
  // cumulative view.
  timeline = timeline.map(getCumul);

  // A feature that is widely available is also newly available.
  // A feature that is newly available is also implemented somewhere.
  // Let's count features only once
  timeline = timeline.map(t => Object.assign({
    date: t.date,
    high: t.high,
    low: t.low - t.high,
    first: t.first - t.low
  }));

  // Export the result to a JSON file
  await fs.writeFile(OUTPUT_TIMELINE, JSON.stringify(timeline, null, 2), "utf8");

  // Compile durations from first implementation to newly available,
  // and from newly available to widely available (the latter one is mostly
  // un-interesting for now, since it's basically always 30 months).
  // Note 2015 durations would not mean much because that is when Edge appears
  // and thus when "newly available" starts to mean something.
  let durations = compileDurations(simplifiedFeatures, years);
  durations = durations
    .filter(y => y.year > FIRST_NEWLY_AVAILABLE_YEAR)
    .filter(y => y.first2low.length > 0)
    .map(y => Object.assign({
      year: y.year,
      min: y.first2low[0],
      q1: getQuantile(y.first2low, 0.25),
      median: getQuantile(y.first2low, 0.50),
      q3: getQuantile(y.first2low, 0.75),
      max: y.first2low[y.first2low.length - 1],
      nb: y.first2low.length
    }));
  await fs.writeFile(OUTPUT_DURATIONS, JSON.stringify(durations, null, 2), "utf8");
}

main();


/**********************************************************
 * A few helper functions
 **********************************************************/
function getCumul(time, idx, list) {
  return {
    date: time.date,
    high: list.slice(0, idx + 1).reduce((tot, d) => tot + d.high.length, 0),
    low: list.slice(0, idx + 1).reduce((tot, d) => tot + d.low.length, 0),
    first: list.slice(0, idx + 1).reduce((tot, d) => tot + d.first.length, 0)
  };
}

function compileDurations(features, years) {
  const durations = years.map(y => Object.assign({
    year: y,
    first2low: [],
    low2high: []
  }));
  for (const feature of features) {
    if (feature.status.baseline_low_date) {
      const year = feature.status.baseline_low_date.slice(0, 4);
      const duration = Math.floor(
        (new Date(feature.status.baseline_low_date) - new Date(feature.status.first_implementation_date)) / 86400000
      );
      durations.find(y => y.year === year).first2low.push(duration);
    }
    if (feature.status.baseline_high_date) {
      const year = feature.status.baseline_high_date.slice(0, 4);
      const duration = Math.floor(
        (new Date(feature.status.baseline_high_date) - new Date(feature.status.baseline_low_date)) / 86400000
      );
      durations.find(y => y.year === year).low2high.push(duration);
    }
  }

  for (const year of durations) {
    year.first2low.sort((d1, d2) => d1 - d2);
    year.low2high.sort((d1, d2) => d1 - d2);
  }
  return durations;
}

function getQuantile(arr, q) {
  const pos = (arr.length - 1) * q;
  const floor = Math.floor(pos);
  const rest = pos - floor;
  if (arr[floor + 1] !== undefined) {
    return arr[floor] + rest * (arr[floor + 1] - arr[floor]);
  }
  else {
    return arr[floor];
  }
};
