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

  if (votes === undefined || votes === null) {
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

function renderFeatureCard(feature, images) {
  const status = getStatus(feature);
  const description = feature.description || defaultDescription;

  return renderDocument(`
    <main class="card feature-card status-${status.modifier}">
      <section class="content">
        <img class="brand" src="${images.brand}" alt="">
        <h1>${escapeHTML(feature.name)}</h1>
        <p class="description">${escapeHTML(description)}</p>
      </section>

      <section class="summary">
        ${renderStatus(status, images)}
        ${renderSignals(feature)}
      </section>

      <ul class="support">
        ${renderBrowserSupport(feature, images)}
      </ul>
    </main>
  `);
}

function renderDefaultCard(images) {
  return renderDocument(`
    <main class="card default-card status-high">
      <section class="content">
        <img class="brand" src="${images.brand}" alt="">
        <h1>Stay up-to-date with the web platform</h1>
        <p class="description">${defaultDescription}</p>
      </section>

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

function renderDocument(body) {
  return `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <style>
          * {
            box-sizing: border-box;
          }

          html,
          body {
            width: ${width}px;
            height: ${height}px;
            margin: 0;
          }

          body {
            display: grid;
            place-items: center;
            background: #ffffff;
            color: #202124;
            font-family:
              Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
              "Segoe UI", sans-serif;
          }

          .card {
            position: relative;
            display: grid;
            grid-template-rows: 1fr auto auto;
            gap: 22px;
            width: ${width}px;
            height: ${height}px;
            overflow: hidden;
            padding: 48px 72px 36px;
            background:
              radial-gradient(circle at top right, rgba(66, 133, 244, 0.18), transparent 310px),
              linear-gradient(135deg, #ffffff 0%, #f7f9fc 46%, #eef6f1 100%);
            border-block-start: 18px solid var(--accent);
          }

          .status-high {
            --accent: #34a853;
            --accent-bg: #e6f4ea;
            --accent-border: #b7dfc0;
          }

          .status-low {
            --accent: #1a73e8;
            --accent-bg: #e8f0fe;
            --accent-border: #c8dafb;
          }

          .status-limited {
            --accent: #5f6368;
            --accent-bg: #f1f3f4;
            --accent-border: #d9dde1;
          }

          .status-discouraged {
            --accent: #c5221f;
            --accent-bg: #fce8e6;
            --accent-border: #f4c7c3;
          }

          .content,
          .summary,
          .support {
            position: relative;
            z-index: 1;
          }

          .brand {
            display: block;
            width: 88px;
            height: auto;
            margin-block-end: 18px;
          }

          h1 {
            max-width: 980px;
            margin: 0;
            font-size: 74px;
            font-weight: 750;
            letter-spacing: 0;
            line-height: 0.98;
            overflow-wrap: anywhere;
          }

          .description {
            display: -webkit-box;
            max-width: 1000px;
            margin: 22px 0 0;
            overflow: hidden;
            color: #3c4043;
            font-size: 29px;
            line-height: 1.28;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 3;
          }

          .summary {
            display: flex;
            align-items: end;
            justify-content: space-between;
            gap: 28px;
          }

          .status {
            display: inline-flex;
            flex-direction: column;
            gap: 10px;
            max-width: 720px;
            padding: 18px 24px;
            background: var(--accent-bg);
            border: 2px solid var(--accent-border);
            border-radius: 8px;
          }

          .status-heading {
            display: inline-flex;
            align-items: center;
            gap: 14px;
          }

          .status-icon {
            width: 42px;
            height: 42px;
            object-fit: contain;
          }

          .status-label {
            color: var(--accent);
            font-size: 32px;
            font-weight: 760;
            line-height: 1.1;
          }

          .status-detail,
          .signal {
            color: #3c4043;
            font-size: 24px;
            line-height: 1.25;
          }

          .signal {
            flex: none;
            padding: 14px 18px;
            background: #ffffff;
            border: 2px solid #dadce0;
            border-radius: 8px;
          }

          .support {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 14px;
            padding: 0;
            margin: 0;
            list-style: none;
          }

          .browser {
            display: grid;
            grid-template-columns: 44px 1fr;
            grid-template-rows: auto auto;
            column-gap: 14px;
            align-items: center;
            min-width: 0;
            padding: 16px 18px;
            background: #ffffff;
            border: 2px solid #dadce0;
            border-radius: 8px;
          }

          .browser.unsupported {
            opacity: 0.58;
          }

          .browser img {
            grid-row: 1 / span 2;
            width: 44px;
            height: 44px;
          }

          .browser-name {
            overflow: hidden;
            font-size: 23px;
            font-weight: 720;
            line-height: 1.1;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .browser-support {
            overflow: hidden;
            color: #5f6368;
            font-size: 20px;
            line-height: 1.2;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .default-card {
            grid-template-rows: 1fr auto;
          }
        </style>
      </head>
      <body>${body}</body>
    </html>`;
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

  await screenshot(page, renderDefaultCard(images), path.join(outputDir, "default.png"));

  for (const feature of features) {
    await screenshot(
      page,
      renderFeatureCard(feature, images),
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
