// @ts-check

import bcd from "@mdn/browser-compat-data" with { type: "json" };
import caniuse from "caniuse-lite";
import fs from "node:fs/promises";
import path from "node:path";
import { features } from "web-features";

import { getAllBCDKeys } from "./utils.js";

const OUTPUT_STATISTICS = path.join(
  import.meta.dirname,
  "site",
  "assets",
  "statistics.json",
);

const TODAY = new Date().toISOString().slice(0, 10);
const HISTORICAL_SOURCE_URL =
  "https://github.com/web-platform-dx/web-features/issues/788";

async function main() {
  const existingStatistics = await readExistingStatistics();
  const currentSnapshot = getCurrentSnapshot(TODAY);
  const snapshots = mergeSnapshots(
    existingStatistics.snapshots ?? [],
    currentSnapshot,
  );

  const statistics = {
    generatedAt: new Date().toISOString(),
    versions: await getVersions(),
    latest: snapshots.at(-1),
    snapshots,
    notes: [
      `Historical rows before this page was added were seeded from weekly report comments in ${HISTORICAL_SOURCE_URL}.`,
      "Rows generated after seeding are computed from the installed web-features, @mdn/browser-compat-data, and caniuse-lite packages.",
    ],
  };

  await fs.writeFile(
    OUTPUT_STATISTICS,
    `${JSON.stringify(statistics, null, 2)}\n`,
    "utf8",
  );
}

async function readExistingStatistics() {
  try {
    return JSON.parse(await fs.readFile(OUTPUT_STATISTICS, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return { snapshots: [] };
    }
    throw error;
  }
}

function getCurrentSnapshot(date) {
  const ordinaryFeatures = Object.values(features).filter(
    (feature) => feature.kind === "feature",
  );
  const bcdKeys = getAllBCDKeys(bcd);
  const mappedBcdKeys = new Set(
    ordinaryFeatures.flatMap((feature) => feature.compat_features ?? []),
  );

  const standardNonDeprecatedBcdKeys = bcdKeys.filter(({ status }) => {
    return status?.standard_track === true && status?.deprecated !== true;
  });

  const visibleCaniuseIds = Object.entries(caniuse.features)
    .filter(([, feature]) => caniuse.feature(feature).shown)
    .map(([id]) => id);
  const visibleCaniuseIdSet = new Set(visibleCaniuseIds);
  const mappedCaniuseIds = new Set(
    ordinaryFeatures
      .flatMap((feature) => {
        if (!feature.caniuse) {
          return [];
        }
        return Array.isArray(feature.caniuse) ? feature.caniuse : [feature.caniuse];
      })
      .filter((id) => visibleCaniuseIdSet.has(id)),
  );

  const bcdKeysMapped = countMappedKeys(bcdKeys, mappedBcdKeys);
  const standardNonDeprecatedBcdKeysMapped = countMappedKeys(
    standardNonDeprecatedBcdKeys,
    mappedBcdKeys,
  );

  return {
    date,
    features: ordinaryFeatures.length,
    bcdKeysMapped,
    bcdKeysTotal: bcdKeys.length,
    bcdKeysUnmapped: bcdKeys.length - bcdKeysMapped,
    bcdCoveragePercent: toPercent(bcdKeysMapped, bcdKeys.length),
    standardNonDeprecatedBcdKeysMapped,
    standardNonDeprecatedBcdKeysTotal: standardNonDeprecatedBcdKeys.length,
    standardNonDeprecatedBcdKeysUnmapped:
      standardNonDeprecatedBcdKeys.length - standardNonDeprecatedBcdKeysMapped,
    standardNonDeprecatedBcdCoveragePercent: toPercent(
      standardNonDeprecatedBcdKeysMapped,
      standardNonDeprecatedBcdKeys.length,
    ),
    caniuseIdsMapped: mappedCaniuseIds.size,
    caniuseIdsTotal: visibleCaniuseIds.length,
    caniuseIdsUnmapped: visibleCaniuseIds.length - mappedCaniuseIds.size,
    caniuseCoveragePercent: toPercent(
      mappedCaniuseIds.size,
      visibleCaniuseIds.length,
    ),
  };
}

function countMappedKeys(keys, mappedKeys) {
  return keys.filter(({ key }) => mappedKeys.has(key)).length;
}

function mergeSnapshots(existingSnapshots, currentSnapshot) {
  const snapshotsByDate = new Map(
    existingSnapshots.map((snapshot) => [snapshot.date, snapshot]),
  );
  snapshotsByDate.set(currentSnapshot.date, currentSnapshot);

  return [...snapshotsByDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

async function getVersions() {
  const webFeaturesPackage = JSON.parse(
    await fs.readFile(new URL("./node_modules/web-features/package.json", import.meta.url), "utf8"),
  );
  const caniuseLitePackage = JSON.parse(
    await fs.readFile(new URL("./node_modules/caniuse-lite/package.json", import.meta.url), "utf8"),
  );

  return {
    webFeatures: webFeaturesPackage.version,
    bcd: bcd.__meta.version,
    caniuseLite: caniuseLitePackage.version,
  };
}

function toPercent(value, total) {
  return total ? Number(((value / total) * 100).toFixed(2)) : 0;
}

main();
