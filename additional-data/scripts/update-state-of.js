import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPO = "https://github.com/Devographics/surveys";
const TEMP_FOLDER = "surveys";
const OUTPUT_FILE = path.join(import.meta.dirname, "../state-of-surveys.json");
const SURVEYS_TO_INCLUDE = ["state_of_css", "state_of_html", "state_of_js"];
const SURVEY_DOMAINS = {
  state_of_css: "stateofcss.com/en-US",
  state_of_html: "stateofhtml.com/en-US",
  state_of_js: "stateofjs.com/en-US",
};
const SURVEY_NAMES = {
  state_of_css: "State of CSS",
  state_of_html: "State of HTML",
  state_of_js: "State of JS",
};

function extractWebFeatureReferences(data) {
  const webFeatureRefs = [];

  function walk(object, objectPath = []) {
    if (!object) {
      return;
    }

    if (Array.isArray(object)) {
      for (let i = 0; i < object.length; i++) {
        walk(object[i], [...objectPath, i]);
      }
      return;
    }

    if (typeof object !== "object") {
      return;
    }

    if (object.webFeature) {
      webFeatureRefs.push({ objectPath, object });
    }

    for (const key in object) {
      walk(object[key], [...objectPath, key]);
    }
  }

  walk(data);

  return webFeatureRefs;
}

function extractSurveyTitleAndLink(path) {
  const survey = path[2];
  const edition = path[3];
  const year = edition.slice(-4);
  const question = path[4];
  const subQuestion = path[5];

  let link = `https://${year}.${SURVEY_DOMAINS[survey]}/${question}/#${subQuestion}`

  // Some quirks of State of surveys.
  link = link.replace("reading_list/reading_list", "features/reading_list");
  link = link.replace("/reading_list/#reading_list", "/features/#reading_list");
  link = link.replace("en-US/web_components/", "en-US/features/web_components/");
  link = link.replace("en-US/mobile_web_apps", "en-US/features/mobile-web-apps");
  link = link.replace("/interactivity", "/features/interactivity");

  if (survey in SURVEY_DOMAINS) {
    return {
      name: `${SURVEY_NAMES[survey]} ${year}`,
      link,
      question,
      subQuestion,
    };
  }

  return null;
}

async function main() {
  // Create a temp folder for the survey data.
  console.log(`Creating temporary folder`);
  const tempFolder = path.join(__dirname, TEMP_FOLDER);
  await fs.mkdir(tempFolder, { recursive: true });

  // Clone the surveys repo.
  console.log(`Cloning ${REPO} into ${tempFolder}`);
  execSync(`git clone --depth 1 ${REPO} ${tempFolder}`);

  // Find all of the *.json files in sub-folders using glob.
  console.log(`Searching for JSON files in ${tempFolder}`);
  const files = glob.sync(`${tempFolder}/**/*.json`);

  const features = {};
  for (const file of files) {
    if (!SURVEYS_TO_INCLUDE.some((survey) => file.includes(survey))) {
      continue;
    }

    let data = null;

    console.log(`Reading ${file}`);
    try {
      const content = await fs.readFile(file, "utf-8");
      data = JSON.parse(content);
    } catch (e) {
      console.error(`Error reading ${file}: ${e.message}`);
      continue;
    }

    console.log(`Extracting web feature references from ${file}`);
    const refs = extractWebFeatureReferences(data);
    for (const ref of refs) {
      const { objectPath, object } = ref;
      const { name, link, question, subQuestion } = extractSurveyTitleAndLink(objectPath);
      const featureId = object.webFeature.id;

      if (!features[featureId]) {
        features[featureId] = [];
      }

      // Find if there's already a reference to the exact same survey link.
      if (features[featureId].some((ref) => ref.link === link)) {
        continue;
      }

      features[featureId].push({ name, link, question, subQuestion, path: objectPath.join(".") });
    }
  }

  console.log("------------------");
  console.log("Web feature references found in the survey data:");
  console.log(features);

  // Delete the folder.
  console.log(`Deleting temporary folder ${tempFolder}`);
  await fs.rm(tempFolder, { recursive: true });

  // Write the data to the output file.
  console.log(`Writing the data to ${OUTPUT_FILE}`);
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(features, null, 2));
}

main();
