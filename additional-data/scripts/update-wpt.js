import fs from "fs/promises";
import path from "path";

const INPUT_URL = "https://raw.githubusercontent.com/captainbrosset/wpt-to-web-features/refs/heads/main/wpt-web-features.json";
const OUTPUT_FILE = path.join(import.meta.dirname, "../wpt.json");

async function main() {
  // Fetch the input data.
  console.log(`Fetching data from ${INPUT_URL}`);
  const response = await fetch(INPUT_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();

  // We only care about the keys.
  const webFeaturesThatHaveWPTs = Object.keys(data);

  // Write the data to the output file.
  console.log(`Writing the data to ${OUTPUT_FILE}`);
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(webFeaturesThatHaveWPTs, null, 2));
}

main();
