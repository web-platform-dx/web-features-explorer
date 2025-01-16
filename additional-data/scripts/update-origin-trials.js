// This script updates the origin-trials.json file with the latest Chrome Origin Trials data.

// The format of the origin-trials.json file is the following: top-level keys are web-features IDs,
// their values are arrays.
// {
//   "<feature-id>": []
// }
// The array for a feature is empty if there aren't any known origin trials for the feature.
// Each known feature origin trial is an object as follows:
// {
//   "browser": "<name of the browser>",
//   "name": "<name of the origin trial>",
//   "start": "<start milestone>",
//   "end": "<end milestone>",
//   "feedbackUrl": "<URL for feedback>",
//   "registrationUrl": "<URL for registration>"
// }

// For Chrome, the script fetches the latest Chrome Origin Trials data by using the chromestatus.com
// API, and updates the origin-trials.json file by mapping spec URLs between the features and the
// OT.

// Other browsers are not supported yet.
// For Edge, see https://developer.microsoft.com/en-us/microsoft-edge/origin-trials/trials
// For Firefox, see https://wiki.mozilla.org/Origin_Trials

import { features } from "web-features";
import fs from "fs/promises";
import trials from "../origin-trials.json" assert { type: "json" };
import path from "path";

const OUTPUT_FILE = path.join(import.meta.dirname, "../origin-trials.json");

async function getChromeAPIData(url) {
  const response = await fetch(url);
  const text = await response.text();

  if (text.startsWith(")]}'")) {
    return JSON.parse(text.substring(5));
  }
  return null;
}

async function getChromeOTs() {
  console.log("Retrieving all Chrome Origin Trials...");
  const chromeOTsData = await getChromeAPIData("https://chromestatus.com/api/v0/origintrials");

  const ots = [];

  if (chromeOTsData) {
    // For each OT in the fetched data.
    for (const ot of chromeOTsData.origin_trials) {
      // Check if the OT is still current.
      if (ot.status !== "ACTIVE") {
        continue;
      }

      // For each active OT, let's retrieve more data from chromestatus.
      const chromeStatusUrl = ot.chromestatus_url;
      const chromeStatusId = chromeStatusUrl.substring(chromeStatusUrl.lastIndexOf("/") + 1);
      console.log(`Retrieving the spec URL for Chrome OT ${ot.display_name}...`);
      const chromeStatusData = await getChromeAPIData(`https://chromestatus.com/api/v0/features/${chromeStatusId}`)
      if (!chromeStatusData) {
        continue;
      }

      ot.spec = chromeStatusData.spec_link;
      ots.push(ot);
    }
  }

  return ots;
}

function findChromeOTForFeature(featureId, chromeOTs) {
  const feature = features[featureId];
  const specs = Array.isArray(feature.spec) ? feature.spec : [feature.spec];

  for (const ot of chromeOTs) {
    // Currently, we match features to OTs by spec URL.
    // Later, it would be great if chromestatus entries had a mapping to web-feature IDs.
    if (specs.some(spec => spec === ot.spec)) {
      return {
        browser: "Chrome",
        name: ot.display_name,
        start: ot.start_milestone,
        end: ot.end_milestone,
        feedbackUrl: ot.feedback_url,
        registrationUrl: `https://developer.chrome.com/origintrials/#/register_trial/${ot.id}`
      };
    }
  }
  return null;
}

async function main() {
  // Reset the trials data.
  // This makes sure we have the latest features, and that old and new trials are
  // removed and added.
  for (const id in features) {
    trials[id] = [];
  }

  const chromeOTs = await getChromeOTs();

  for (const featureId in trials) {
    // We only support Chrome for now.
    const chromeOT = findChromeOTForFeature(featureId, chromeOTs);
    if (chromeOT) {
      console.log(`Adding Chrome Origin Trial for feature ${featureId}: ${chromeOT.name}`);
      trials[featureId].push(chromeOT);
    }
  }

  // Sort the trials by ID.
  const ordered = {};
  Object.keys(trials)
    .sort()
    .forEach(function (id) {
      ordered[id] = trials[id];
    });

  // Store the updated trials back in the file.
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(ordered, null, 2));
}

main();
