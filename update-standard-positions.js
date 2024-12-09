// This script updates the standard-positions.json file with the positions and concerns
// found in the GitHub issues of the vendors that have a URL in the standard-positions.json file.
// It can take a while to run.
// This script is not run automatically yet. Run it manually when you want to update the positions.

import { features } from "web-features";
import playwright from "playwright";
import fs from "fs/promises";
import positions from "./standard-positions.json" assert { type: "json" };

const OUTPUT_FILE = "./standard-positions.json";

async function getPosition(url) {
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

  // Update the positions and concerns for the features that have vendor URLs.
  for (const featureId in positions) {
    for (const company in positions[featureId]) {
      if (positions[featureId][company].url) {
        console.log(
          `Updating position for ${company} in feature ${featureId}...`
        );
        const data = await getPosition(positions[featureId][company].url);
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
