// Run this script to add new feature IDs into the mdn-docs.json file.
// This script is not run automatically yet. Run it manually when you want
// to make sure the mdn-docs.json file contains the full list of features.
// This script does not map features to MDN URLs on its own. Mapping MDN URLs
// is done manually.

import { features } from "web-features";
import bcd from "@mdn/browser-compat-data" with { type: "json" };
import * as fs from "fs/promises";
import mdnDocsOverrides from "../mdn-docs.json" with { type: "json" };
import path from "path";

const FILE = path.join(import.meta.dirname, "../mdn-docs.json");

function getFeaturesMdnUrls() {
  const output = {};

  for (const id in features) {
    const feature = features[id];
    const urls = [];

    const keys = feature.compat_features;
    if (keys && keys.length) {
      for (const key of keys) {
        const keyParts = key.split(".");

        let data = bcd;
        for (const part of keyParts) {
          if (!data || !data[part]) {
            console.warn(
              `No BCD data for ${key}. Check if the web-features and browser-compat-data dependencies are in sync.`
            );
            continue;
          }
          data = data[part];
        }

        let url = data.__compat.mdn_url;
        if (url) {
          url = url.replace("https://developer.mozilla.org/docs/", "");
          urls.push(url);
        }
      }
    }

    if (urls.length) {
      output[id] = urls;
    }
  }

  return output;
}

async function main() {
  const featuresMdnUrls = getFeaturesMdnUrls();

  for (const id in features) {
    // If there's already an override, skip.
    if (mdnDocsOverrides[id] && mdnDocsOverrides[id].length) {
      continue;
    }

    // No override found, let's see if we have a single MDN URL for this feature.
    if (featuresMdnUrls[id] && featuresMdnUrls[id].length === 1) {
      // Yes, let's add it to the data.
      mdnDocsOverrides[id] = [featuresMdnUrls[id][0]];
    } else {
      // Otherwise, add the feature ID to the data with an empty array.
      mdnDocsOverrides[id] = [];
    }

    // Report special cases
    // if (featuresMdnUrls[id] && featuresMdnUrls[id].length === 2) {
    //   console.log('---');
    //   console.log(id);
    //   console.log(`  "${featuresMdnUrls[id]}"`);
    // }
  }

  // Sort mdnDocsOverrides by key.
  const orderedDocOverrides = {};
  Object.keys(mdnDocsOverrides)
    .sort()
    .forEach(function (key) {
      orderedDocOverrides[key] = mdnDocsOverrides[key];
    });

  // Write the JSON file back to disk.
  const str = JSON.stringify(orderedDocOverrides, null, 2);
  await fs.writeFile(FILE, str);
}

main();
