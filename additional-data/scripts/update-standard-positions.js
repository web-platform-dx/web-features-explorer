// This script updates the standard-positions.json file with the positions and concerns
// found in the GitHub issues of the vendors that have a URL in the standard-positions.json file.
// It can take a while to run.
// This script is not run automatically yet. Run it manually when you want to update the positions.
// This script does not detect new standard position URLs for features. You first need to add the URLs in
// the standard-positions.json file before running this script.

import { features } from "web-features";
import playwright from "playwright";
import fs from "fs/promises";
import positions from "../standard-positions.json" assert { type: "json" };

const OUTPUT_FILE = "../standard-positions.json";

const MOZILLA_DATA_FILE = "https://raw.githubusercontent.com/mozilla/standards-positions/refs/heads/gh-pages/merged-data.json";
let mozillaData = null;
async function getMozillaData() {
  if (!mozillaData) {
    const response = await fetch(MOZILLA_DATA_FILE);
    mozillaData = await response.json();
  }

  return mozillaData;
}

// For Mozilla, we can use the consolidated data file.
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

// For webkit, we need to scrape the position and concerns from the GitHub issue.
async function getWebkitPosition(url) {
  const scrapingBrowser = await playwright.chromium.launch({ headless: true });
  const context = await scrapingBrowser.newContext();
  const page = await context.newPage();

  // Go to the page.
  await page.goto(url);

  // Wait for the page to be completely loaded.
  // In particular, wait for the list of labels in the sidebar.
  await page.waitForSelector(
    ".Layout-sidebar .discussion-sidebar-heading:has-text('Labels')"
  );

  // Get the list of labels in the sidebar.
  const labelEls = await page
    .locator(".js-issue-labels a span")
    .allTextContents();

  await scrapingBrowser.close();

  return labelEls
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.startsWith("position:") || t.startsWith("concerns:"))
    .map((t) => {
      if (t.startsWith("position:")) {
        return { position: t.substring("position:".length).trim() };
      }
      if (t.startsWith("concerns:")) {
        return { concern: t.substring("concerns:".length).trim() };
      }
    })
    .reduce(
      (acc, curr) => {
        if (curr.position) {
          acc.position = curr.position;
        } else {
          acc.concerns.push(curr.concern);
        }
        return acc;
      },
      { position: "", concerns: [] }
    );
}

async function getPosition(company, url) {
  switch (company) {
    case "webkit":
      return await getWebkitPosition(url);
    case "mozilla":
      return await getMozillaPosition(url);
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

  // Second, for Mozilla only, attempt to find new vendor URLs,
  // by matching on spec URLs.
  const data = await getMozillaData();
  for (const issueId in data) {
    const issue = data[issueId];
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
      const feature = features[featureId];
      const featureSpecs = Array.isArray(feature.spec) ? feature.spec : [feature.spec];
      if (featureSpecs.some((spec) => spec === issue.url)) {
        positions[featureId].mozilla.url = `https://github.com/mozilla/standards-positions/issues/${issueId}`;
      }
    }
  }

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
