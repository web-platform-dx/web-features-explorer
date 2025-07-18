// This script updates the use-counters.json file with the latest usage data about web features.

// The use-counters.json file is structured as follows.
//
// Top-level keys are web-features IDs, and their values are objects with ...
// {
//    "<feature-id>": {
//      ...
//   }
// }
//

import { features } from "web-features";
import fs from "fs/promises";
import useCounters from "../use-counters.json" with { type: "json" };
import path from "path";

const OUTPUT_FILE = path.join(import.meta.dirname, "../use-counters.json");

// UC names can be derived from web-feature IDs, but not the other way around.
// The chromestatus API we use to get the list of use-counters returns UC names.
// So, this function first converts all web-feature IDs to expected UC names,
// and then reverses the map. This way, when we query the API, we can lookup
// the UC names the API returns and get the web-feature IDs from them.
let UCNAMES_TO_WFIDS = {};
function prepareUseCounterMapping() {
  // See the rule which Chromium uses at:
  // https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/public/mojom/use_counter/metrics/webdx_feature.mojom;l=35-47;drc=af140c76c416302ecadb5e7cf3f989d6293ba5ec
  // In short, uppercase the first letter in each sequence of letters and remove hyphens.
  Object.keys(features).forEach(id => {
    const expectedUCName = id
      .replace(/[a-z]+/g, (m) => m[0].toUpperCase() + m.substring(1))
      .replaceAll("-", "");
    UCNAMES_TO_WFIDS[expectedUCName] = id;
  });
}
prepareUseCounterMapping();

async function getWebFeaturesThatMapToUseCounters() {
  // Get the latest chromium source file which contains all use counters.
  const response = await fetch("https://raw.githubusercontent.com/chromium/chromium/refs/heads/main/third_party/blink/public/mojom/use_counter/metrics/webdx_feature.mojom");
  const sourceText = await response.text();

  // Parse the source text to extract all use counters.
  // The lines that we are interested in look like this:
  // kSomeUseCounterName = number,
  const useCounterLines = sourceText.match(/k([A-Z][a-zA-Z0-9_]+) = (\d+),\n/g);
  if (!useCounterLines) {
    throw new Error("Failed to parse use counters from the source file.");
  }

  const ret = {};

  for (const line of useCounterLines) {
    // Extract the use counter ID and name from the line.
    const match = line.match(/k([A-Z][a-zA-Z0-9_]+) = (\d+),/);
    if (!match) {
      console.warn(`Failed to parse line: ${line}`);
      continue;
    }
    const ucName = match[1];
    const ucId = parseInt(match[2], 10);

    // Some useCounters are drafts. This happens when the
    // corresponding web-feature is not yet in web-features.
    // In theory, we ignore them, but we also check if there
    // is a feature by that name anyway.
    if (ucName.startsWith("DRAFT_")) {
      // Check, just in case, if the feature is now in web-features.
      const wfid = UCNAMES_TO_WFIDS[ucName.replace("DRAFT_", "")];
      if (features[wfid]) {
        console.warn(
          `Use-counter ${ucName} is a draft, but the feature ${wfid} exists in web-features.`
        );
      }

      console.log(`Ignoring use-counter: ${ucName} since it's a draft.`);
      continue;
    }

    // Some useCounters are obsolete. We ignore them.
    if (ucName.startsWith("OBSOLETE_")) {
      console.log(`Ignoring use-counter: ${ucName} since it's an obsolete counter.`);
      continue;
    }

    const webFeatureId = UCNAMES_TO_WFIDS[ucName];
    if (!webFeatureId) {
      console.warn(`No web-feature ID found for use-counter: ${ucName}`);
      continue;
    }

    ret[webFeatureId] = { ucId, ucName };
  }

  return ret;
}

async function getFeatureUsageInPercentageOfPageLoads(ucId) {
  const response = await fetch(`https://chromestatus.com/data/timeline/webfeaturepopularity?bucket_id=${ucId}`);
  const data = await response.json();
  // The API returns data for a few months, but it seems like the older the data, the less granular it is.
  // We don't care much for historical data here, so just return the last day.
  return data.length ? data[data.length - 1].day_percentage : null;
}

async function main() {
  // First, add any missing feature IDs to the useCounters object.
  for (const id in features) {
    if (!useCounters[id]) {
      useCounters[id] = {};
    }
  }

  // Now find the use-counters that map to web-features.
  const wfToUcMapping = await getWebFeaturesThatMapToUseCounters();

  // For each, get the usage stats.
  for (const wfId in wfToUcMapping) {
    console.log(`Getting usage for ${wfId}...`);
    const { ucId } = wfToUcMapping[wfId];
    const usage = await getFeatureUsageInPercentageOfPageLoads(ucId);
    if (usage) {
      useCounters[wfId] = {
        percentageOfPageLoad: usage,
        chromeStatusUrl: `https://chromestatus.com/metrics/webfeature/timeline/popularity/${ucId}`
      };
    }
  }

  // Sort the useCounters by ID.
  const ordered = {};
  Object.keys(useCounters)
    .sort()
    .forEach(function (id) {
      ordered[id] = useCounters[id];
    });

  // Store the updated positions back in the file.
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(ordered, null, 2));
}

main();
