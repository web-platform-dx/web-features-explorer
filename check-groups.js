import fs from 'fs/promises';
import { features } from "web-features";

const FILE = 'site/_data/featureCatalog.yml';

async function main() {
  const content = await fs.readFile(FILE, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, i) => {
    if (line.trim().startsWith("- ")) {
      // It's a feature.
      const idToCheck = line.trim().substring(2);
      if (!features[idToCheck]) {
        console.warn(`Feature ${idToCheck} was not found.`);
      }
    }
  });

  for (const id in features) {
    if (!content.includes(`- ${id}\r\n`)) {
      console.warn(`Feature ${id} is missing from the list of groups`);
    }
  }
}

main();
