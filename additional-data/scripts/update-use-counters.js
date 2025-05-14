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

// Some useCounter names do not follow the rule for dash-to-camelCase conversion.
// Mapping them manually here.
const UCNAME_TO_WFID_SPECIAL_CASES = {
  "Float16array": "float16array",
  "LaunchHandler": "app-launch-handler",
  "MoveBeforeAPI": "move-before"
};

// Some useCounter names don't seem to have corresponding web-features IDs.
// Ignoring them for now.
const UCNAME_TO_IGNORE = [
  "PageVisits",
  "WebAppManifestUpdateToken"
];

function convertUseCounterIdToWebFeatureId(id) {
  // Some special cases.
  if (UCNAME_TO_WFID_SPECIAL_CASES[id]) {
    return UCNAME_TO_WFID_SPECIAL_CASES[id];
  }

  // Otherwise convert with camelcase to dash.
  // Use counter IDs are camelcased.
  // So, split by capitalized words, and then join with dashes.
  // Example AbortsignalAny -> abortsignal-any
  return id.replace(/([a-z])([A-Z0-9])/g, "$1-$2").toLowerCase();
}

async function getWebFeaturesThatMapToUseCounters() {
  const response = await fetch(
    "https://chromestatus.com/data/blink/webfeatureprops"
  );
  const data = await response.json();

  const ret = {};

  for (const [useCounterNum, useCounterId] of data) {
    // Some useCounters are drafts. This happens when the
    // corresponding web-feature is not yet in web-features.
    // In theory, we ignore them, but we also check if there
    // is a feature by that name anyway.
    if (useCounterId.startsWith("DRAFT_")) {
      // Check, just in case, if the feature is now in web-features.
      const nonDraftName = useCounterId.replace("DRAFT_", "");
      const wfid = convertUseCounterIdToWebFeatureId(nonDraftName);
      if (features[wfid]) {
        console.warn(
          `Use-counter ${useCounterId} is a draft, but the feature ${wfid} exists in web-features.`
        );
      }

      console.log(`Ignoring use-counter: ${useCounterId} since it's a draft.`);
      continue;
    }

    // Some useCounters are obsolete. We ignore them.
    if (useCounterId.startsWith("OBSOLETE_")) {
      console.log(`Ignoring use-counter: ${useCounterId} since it's an obsolete counter.`);
      continue;
    }

    // Some useCounters are just not in web-features, not sure why.
    // Ignore them for now.
    if (UCNAME_TO_IGNORE.includes(useCounterId)) {
      console.warn(`Ignoring use-counter: ${useCounterId} since we can't find an equivalent.`);
      continue;
    }

    const webFeatureId = convertUseCounterIdToWebFeatureId(useCounterId);
    ret[webFeatureId] = { useCounterNum, useCounterId };
  }

  return ret;
}

async function getFeatureUsageInPercentageOfPageLoads(useCounterNum) {
  const response = await fetch(`https://chromestatus.com/data/timeline/webfeaturepopularity?bucket_id=${useCounterNum}`);
  const data = await response.json();
  // The API returns data for a few months, but it seems like the older the data, the less granular it is.
  // We don't care much for historical data here, so just return the last day.
  return data.length ? data[data.length - 1].day_percentage : null;
}

async function main() {
  // First, add any missing feature ID to the useCounters object.
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
    const { useCounterNum } = wfToUcMapping[wfId];
    const usage = await getFeatureUsageInPercentageOfPageLoads(useCounterNum);
    if (usage) {
      useCounters[wfId] = {
        percentageOfPageLoad: usage,
        chromeStatusUrl: `https://chromestatus.com/metrics/webfeature/timeline/popularity/${useCounterNum}`
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
