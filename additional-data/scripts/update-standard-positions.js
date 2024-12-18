// This script updates the standard-positions.json file with the positions and concerns
// found in the GitHub issues of the vendors that have a URL in the standard-positions.json file.
// It can take a while to run.
// This script is not run automatically yet. Run it manually when you want to update the positions.
// Always check the new position URLs added by the script (for mozilla only for now) to make sure they are correct.
// This script attempts to detect new standard position URLs for features, only for Mozilla for now.
// For webkit, you first need to add the URLs in the standard-positions.json file before running this script.

import { features } from "web-features";
import playwright from "playwright";
import fs from "fs/promises";
import positions from "../standard-positions.json" assert { type: "json" };

const OUTPUT_FILE = "../standard-positions.json";

const MOZILLA_DATA_FILE =
  "https://raw.githubusercontent.com/mozilla/standards-positions/refs/heads/gh-pages/merged-data.json";
let mozillaData = null;
async function getMozillaData() {
  if (!mozillaData) {
    const response = await fetch(MOZILLA_DATA_FILE);
    mozillaData = await response.json();
  }

  return mozillaData;
}

async function getMozillaPosition(url) {
  const data = await getMozillaData();

  const issueId = url.split("/").pop();
  const issue = data[issueId];
  if (!issue) {
    return { position: "", concerns: [] };
  }

  return {
    position: issue.position || "",
    concerns: issue.concerns,
  };
}

const WEBKIT_DATA_FILE =
  "https://raw.githubusercontent.com/WebKit/standards-positions/main/summary.json";
let webkitData = null;
async function getWebkitData() {
  if (!webkitData) {
    const response = await fetch(WEBKIT_DATA_FILE);
    webkitData = await response.json();
  }

  return webkitData;
}

async function getWebkitPosition(url) {
  const data = await getWebkitData();

  for (const position of data) {
    if (position.id === url) {
      return {
        position: position.position || "",
        concerns: position.concerns || [],
      };
    }
  }

  return { position: "", concerns: [] };
}

async function getPosition(company, url) {
  switch (company) {
    case "webkit":
      return await getWebkitPosition(url);
    case "mozilla":
      return await getMozillaPosition(url);
  }
}

function doesFeatureHaveSpec(feature, url) {
  const featureSpecs = Array.isArray(feature.spec)
    ? feature.spec
    : [feature.spec];
  return featureSpecs.some((spec) => spec === url);
}

async function findNewMozillaURLs() {
  // Attempt to find new vendor URLs, by matching on spec URLs.
  const mozData = await getMozillaData();

  for (const issueId in mozData) {
    const issue = mozData[issueId];
    if (!issue.position) {
      continue;
    }

    // Go over our features, and try to find a match,
    // by comparing spec urls.
    for (const featureId in features) {
      // Skip the features for which we already have the URL.
      if (positions[featureId].mozilla.url) {
        continue;
      }
      const matches = doesFeatureHaveSpec(features[featureId], issue.url);
      const issueUrl = `https://github.com/mozilla/standards-positions/issues/${issueId}`;
      const isWrongIssue = positions[featureId].mozilla.not && positions[featureId].mozilla.not.includes(issueUrl);
      if (matches && !isWrongIssue) {
        positions[
          featureId
        ].mozilla.url = issueUrl;
      }
    }
  }
}

async function findNewWebkitURLs() {
  // Attempt to find new vendor URLs, by matching on spec URLs.
  const webkitData = await getWebkitData();

  for (const issue of webkitData) {
    if (!issue.position) {
      continue;
    }

    // Go over our features, and try to find a match,
    // by comparing spec urls.
    for (const featureId in features) {
      // Skip the features for which we already have the URL.
      if (positions[featureId].webkit.url) {
        continue;
      }
      const matches = doesFeatureHaveSpec(features[featureId], issue.url);
      const isWrongIssue = positions[featureId].webkit.not && positions[featureId].webkit.not.includes(issue.id);
      if (matches && !isWrongIssue) {
        positions[featureId].webkit.url = issue.id;
      }
    }
  }
}

async function main() {
  // First, add any missing feature ID to the positions object.
  for (const id in features) {
    if (!positions[id]) {
      positions[id] = {
        mozilla: {},
        webkit: {},
      };
    }
  }

  // Try to add new mozilla vendor position urls to web-features.
  await findNewMozillaURLs();
  // Do the same for webkit.
  await findNewWebkitURLs();

  // Finally, update the positions and concerns for the features that have vendor URLs.
  for (const featureId in positions) {
    for (const company in positions[featureId]) {
      if (positions[featureId][company].url) {
        console.log(
          `Updating position for ${company} in feature ${featureId}...`
        );
        const data = await getPosition(
          company,
          positions[featureId][company].url
        );
        positions[featureId][company].position = data.position;
        positions[featureId][company].concerns = data.concerns;
      }
    }
  }

  // Sort the positions by ID.
  const ordered = {};
  Object.keys(positions)
    .sort()
    .forEach(function (id) {
      ordered[id] = positions[id];
    });

  // Store the updated positions back in the file.
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(ordered, null, 2));
}

main();
