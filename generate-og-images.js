import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const width = 1200;
const height = 630;
const outputDir = path.resolve("docs/assets/og");
const featureOutputDir = path.join(outputDir, "features");
const featuresDir = path.resolve("docs/features");
const assetDir = path.resolve("site/assets");
const ogAssetDir = path.join(assetDir, "og");
const templateFile = path.join(ogAssetDir, "template.html");
const defaultDescription =
  "Discover new features and APIs and stay up-to-date with changes across the web platform.";

const browsers = [
  { id: "chrome", name: "Chrome", icon: "chrome.svg" },
  { id: "edge", name: "Edge", icon: "edge.svg" },
  { id: "firefox", name: "Firefox", icon: "firefox.svg" },
  { id: "safari", name: "Safari", icon: "safari.svg" },
];

function escapeHTML(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getStatus(feature) {
  if (feature.discouraged) {
    return {
      label: "Discouraged",
      modifier: "discouraged",
      detail: feature.discouraged.reason || "This feature is discouraged.",
      icon: null,
    };
  }

  if (feature.status?.baseline === "high") {
    return {
      label: "Baseline Widely Available",
      modifier: "high",
      detail: `Since ${formatBaselineDate(feature.status.baseline_high_date)}`,
      icon: "baseline-widely-icon.svg",
    };
  }

  if (feature.status?.baseline === "low") {
    return {
      label: "Baseline Newly Available",
      modifier: "low",
      detail: `Since ${formatBaselineDate(feature.status.baseline_low_date)}`,
      icon: "baseline-newly-icon.svg",
    };
  }

  return {
    label: "Limited availability",
    modifier: "limited",
    detail: "Not yet supported across all core browsers.",
    icon: "baseline-limited-icon.svg",
  };
}

function formatBaselineDate(date = "") {
  return date.startsWith("≤") ? `before ${date.slice(1)}` : date;
}

function getSupportLabel(feature, browserId) {
  const version = feature.status?.support?.[browserId];
  if (!version) {
    return "No support";
  }

  return version.startsWith("≤") ? `<= ${version.slice(1)}` : `v${version}`;
}

async function getSvgDataUrl(file) {
  const svg = await fs.readFile(file, "utf8");
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

async function getImageDataUrls() {
  const images = {
    brand: await getSvgDataUrl(path.join(ogAssetDir, "webdx-notext.svg")),
    baseline: {
      "baseline-limited-icon.svg": await getSvgDataUrl(
        path.join(ogAssetDir, "baseline-limited-icon.svg"),
      ),
      "baseline-newly-icon.svg": await getSvgDataUrl(
        path.join(ogAssetDir, "baseline-newly-icon.svg"),
      ),
      "baseline-widely-icon.svg": await getSvgDataUrl(
        path.join(ogAssetDir, "baseline-widely-icon.svg"),
      ),
    },
    browsers: {},
  };

  await Promise.all(
    browsers.map(async (browser) => {
      images.browsers[browser.id] = await getSvgDataUrl(
        path.join(assetDir, browser.icon),
      );
    }),
  );

  return images;
}

function renderBrowserSupport(feature, images) {
  return browsers
    .map((browser) => {
      const version = feature.status?.support?.[browser.id];
      const supportedClass = version ? "supported" : "unsupported";
      const support = getSupportLabel(feature, browser.id);

      return `
        <li class="browser ${supportedClass}">
          <img src="${images.browsers[browser.id]}" alt="">
          <span class="browser-name">${browser.name}</span>
          <span class="browser-support">${escapeHTML(support)}</span>
        </li>
      `;
    })
    .join("");
}

function renderSignals(feature) {
  const votes = feature.developerSignals?.votes;

  if (votes == null) {
    return "";
  }

  return `<span class="signal">${votes.toLocaleString("en-US")} developer signal votes</span>`;
}

function renderStatus(status, images) {
  const icon = status.icon
    ? `<img class="status-icon" src="${images.baseline[status.icon]}" alt="">`
    : "";

  return `
    <div class="status">
      <span class="status-heading">
        ${icon}
        <span class="status-label">${escapeHTML(status.label)}</span>
      </span>
      <span class="status-detail">${escapeHTML(status.detail)}</span>
    </div>
  `;
}

async function renderFeatureCard(feature, images) {
  const status = getStatus(feature);
  const description = feature.description || defaultDescription;

  return renderDocument(`
    <article class="card feature-card status-${status.modifier}">
      <header class="content">
        <img class="brand" src="${images.brand}" alt="">
        <h1>${escapeHTML(feature.name)}</h1>
        <p class="description">${escapeHTML(description)}</p>
      </header>

      <section class="summary">
        ${renderStatus(status, images)}
        ${renderSignals(feature)}
      </section>

      <ul class="support">
        ${renderBrowserSupport(feature, images)}
      </ul>
    </article>
  `);
}

async function renderDefaultCard(images) {
  return renderDocument(`
    <main class="card default-card status-high">
      <header class="content">
        <img class="brand" src="${images.brand}" alt="">
        <h1>Stay up-to-date with the web platform</h1>
        <p class="description">${defaultDescription}</p>
      </header>

      <section class="summary">
        ${renderStatus(
          {
            label: "Web platform data",
            detail: "Baseline status, browser support, specs, and developer signals.",
            icon: "baseline-widely-icon.svg",
          },
          images,
        )}
      </section>
    </main>
  `);
}

async function renderDocument(body) {
  const template = await fs.readFile(templateFile, "utf8");

  return template
    .replaceAll("{{ width }}", width)
    .replaceAll("{{ height }}", height)
    .replace("{{ body }}", body);
}

async function getFeatureFiles() {
  const entries = await fs.readdir(featuresDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(featuresDir, entry.name))
    .sort();
}

async function readFeature(file) {
  const feature = JSON.parse(await fs.readFile(file, "utf8"));
  return feature.kind === "feature" ? feature : null;
}

async function screenshot(page, html, outputPath) {
  await page.setContent(html, {
    waitUntil: "load",
  });

  await page.screenshot({
    path: outputPath,
    clip: { x: 0, y: 0, width, height },
  });
}

async function generate() {
  await fs.mkdir(featureOutputDir, { recursive: true });

  const images = await getImageDataUrls();
  const files = await getFeatureFiles();
  const features = (await Promise.all(files.map(readFeature))).filter(Boolean);
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });

  await screenshot(
    page,
    await renderDefaultCard(images),
    path.join(outputDir, "default.png"),
  );

  for (const feature of features) {
    await screenshot(
      page,
      await renderFeatureCard(feature, images),
      path.join(featureOutputDir, `${feature.id}.png`),
    );
  }

  await browser.close();
  console.log(`Generated ${features.length + 1} OpenGraph images.`);
}

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
