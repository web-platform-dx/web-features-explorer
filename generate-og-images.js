import fs from "node:fs/promises";
import path from "node:path";
import { generateOpenGraphCards } from "@schalkneethling/opengraph-cards-maker";

const outputDir = path.resolve("docs/assets/og");
const featureOutputDir = path.join(outputDir, "features");
const featuresDir = path.resolve("docs/features");
const brandSrc = "site/assets/og/webdx-notext.svg";
const defaultDescription =
  "Discover new features and APIs and stay up-to-date with changes across the web platform.";

const browsers = [
  { id: "chrome", name: "Chrome", icon: "site/assets/chrome.svg" },
  { id: "edge", name: "Edge", icon: "site/assets/edge.svg" },
  { id: "firefox", name: "Firefox", icon: "site/assets/firefox.svg" },
  { id: "safari", name: "Safari", icon: "site/assets/safari.svg" },
];

const themes = {
  high: {
    accent: "#34a853",
    accentBackground: "#e6f4ea",
    border: "#b7dfc0",
  },
  low: {
    accent: "#1a73e8",
    accentBackground: "#e8f0fe",
    border: "#c8dafb",
  },
  limited: {
    accent: "#f09409",
    accentBackground: "#fff4e0",
    border: "#f6c982",
  },
  discouraged: {
    accent: "#c5221f",
    accentBackground: "#fce8e6",
    border: "#f4c7c3",
  },
};

function formatBaselineDate(date = "") {
  return date.startsWith("≤") ? `before ${date.slice(1)}` : date;
}

function getStatus(feature) {
  if (feature.discouraged) {
    return {
      label: "Discouraged",
      detail: feature.discouraged.reason || "This feature is discouraged.",
      icon: null,
      theme: themes.discouraged,
    };
  }

  if (feature.status?.baseline === "high") {
    return {
      label: "Baseline Widely Available",
      detail: `Since ${formatBaselineDate(feature.status.baseline_high_date)}`,
      icon: "site/assets/og/baseline-widely-icon.svg",
      theme: themes.high,
    };
  }

  if (feature.status?.baseline === "low") {
    return {
      label: "Baseline Newly Available",
      detail: `Since ${formatBaselineDate(feature.status.baseline_low_date)}`,
      icon: "site/assets/og/baseline-newly-icon.svg",
      theme: themes.low,
    };
  }

  return {
    label: "Limited availability",
    detail: "Not yet supported across all core browsers.",
    icon: "site/assets/og/baseline-limited-icon.svg",
    theme: themes.limited,
  };
}

function renderProjectCard({ card, images, size, escapeHTML }) {
  const support = images.support
    .map((item) => {
      const mutedClass = item.supported === false ? " is-muted" : "";

      return `
        <li class="support-item${mutedClass}">
          ${item.icon ? `<img src="${item.icon}" alt="">` : ""}
          <span class="support-copy">
            <strong>${escapeHTML(item.name)}</strong>
            <span>${escapeHTML(item.detail)}</span>
          </span>
        </li>
      `;
    })
    .join("");
  const status = card.status
    ? `
      <section class="status">
        ${images.status ? `<img src="${images.status}" alt="">` : ""}
        <span class="status-copy">
          <strong>${escapeHTML(card.status.label)}</strong>
          <span>${escapeHTML(card.status.detail)}</span>
        </span>
      </section>
    `
    : "";

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
        inline-size: ${size.width}px;
        block-size: ${size.height}px;
        margin: 0;
      }

      body {
        display: grid;
        place-items: center;
        background: #ffffff;
        color: #111827;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
      }

      .card {
        --accent: ${card.theme?.accent ?? "#34a853"};
        --accent-bg: ${card.theme?.accentBackground ?? "#e6f4ea"};
        --accent-border: ${card.theme?.border ?? "#b7dfc0"};
        position: relative;
        display: grid;
        grid-template-rows: 1fr auto auto;
        gap: 22px;
        inline-size: calc(100% - 16px);
        block-size: calc(100% - 16px);
        overflow: hidden;
        padding: 70px 72px 40px;
        background:
          radial-gradient(circle at 82% 16%, rgba(168, 199, 250, 0.46), transparent 360px),
          radial-gradient(circle at 76% 84%, rgba(196, 238, 208, 0.42), transparent 360px),
          linear-gradient(135deg, #ffffff 0%, #f8fbff 100%);
        border-radius: 8px;
      }

      .card::before {
        position: absolute;
        inset: 0 0 auto;
        block-size: 18px;
        background: var(--accent);
        content: "";
      }

      .brand {
        display: block;
        inline-size: 88px;
        block-size: auto;
        margin-block-end: 28px;
      }

      h1 {
        max-inline-size: 960px;
        margin: 0;
        color: #111827;
        font-size: 64px;
        font-weight: 780;
        letter-spacing: 0;
        line-height: 0.98;
        overflow-wrap: anywhere;
      }

      .description {
        display: -webkit-box;
        max-inline-size: 1060px;
        margin: 24px 0 0;
        overflow: hidden;
        color: #3f4754;
        font-size: 30px;
        line-height: 1.28;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
      }

      .status {
        display: inline-grid;
        grid-template-columns: auto 1fr;
        gap: 18px;
        align-items: center;
        justify-self: start;
        min-inline-size: 480px;
        max-inline-size: 520px;
        padding: 20px 26px;
        background: var(--accent-bg);
        border: 2px solid var(--accent-border);
        border-radius: 8px;
      }

      .status img {
        inline-size: 42px;
        block-size: 42px;
        object-fit: contain;
      }

      .status-copy {
        display: grid;
        gap: 12px;
      }

      .status-copy strong {
        color: var(--accent);
        font-size: 32px;
        font-weight: 780;
        line-height: 1;
      }

      .status-copy span {
        color: #3f4754;
        font-size: 24px;
        line-height: 1.1;
      }

      .support {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
        padding: 0;
        margin: 0;
        list-style: none;
      }

      .support:empty {
        display: none;
      }

      .support-item {
        display: grid;
        grid-template-columns: 52px 1fr;
        gap: 18px;
        align-items: center;
        min-inline-size: 0;
        padding: 18px 22px;
        background: rgba(255, 255, 255, 0.72);
        border: 2px solid #d9dde1;
        border-radius: 8px;
      }

      .support-item.is-muted {
        opacity: 0.58;
      }

      .support-item img {
        inline-size: 52px;
        block-size: 52px;
        object-fit: contain;
      }

      .support-copy {
        display: grid;
        gap: 4px;
        min-inline-size: 0;
      }

      .support-copy strong {
        overflow: hidden;
        color: #202124;
        font-size: 24px;
        font-weight: 760;
        line-height: 1.1;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .support-copy span {
        overflow: hidden;
        color: #5f6368;
        font-size: 20px;
        line-height: 1.1;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <section>
        ${images.brand ? `<img class="brand" src="${images.brand}" alt="">` : ""}
        <h1>${escapeHTML(card.title)}</h1>
        <p class="description">${escapeHTML(card.description)}</p>
      </section>
      ${status}
      <ul class="support">${support}</ul>
    </main>
  </body>
</html>`;
}

function getSupportLabel(feature, browserId) {
  const version = feature.status?.support?.[browserId];
  if (!version) {
    return "No support";
  }

  return version.startsWith("≤") ? `<= ${version.slice(1)}` : `v${version}`;
}

function getSupport(feature) {
  return browsers.map((browser) => {
    const version = feature.status?.support?.[browser.id];

    return {
      name: browser.name,
      detail: getSupportLabel(feature, browser.id),
      supported: Boolean(version),
      icon: browser.icon,
    };
  });
}

function getMeta(feature) {
  const votes = feature.developerSignals?.votes;

  return votes == null
    ? []
    : [{ label: "Developer signals", value: votes.toLocaleString("en-US") }];
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

function createFeatureCard(feature) {
  const status = getStatus(feature);

  return {
    id: feature.id,
    outputPath: path.join(featureOutputDir, `${feature.id}.png`),
    eyebrow: "Web platform features explorer",
    title: feature.name,
    description: feature.description || defaultDescription,
    brand: {
      src: brandSrc,
    },
    status: {
      label: status.label,
      detail: status.detail,
      icon: status.icon,
    },
    support: getSupport(feature),
    meta: getMeta(feature),
    theme: status.theme,
  };
}

async function generate() {
  const files = await getFeatureFiles();
  const features = (await Promise.all(files.map(readFeature))).filter(Boolean);
  const cards = [
    {
      id: "default",
      brand: {
        src: brandSrc,
      },
      title: "Stay up-to-date with the web platform",
      description: defaultDescription,
      status: {
        label: "Web platform data",
        detail: "Baseline status, browser support, specs, and developer signals.",
        icon: "site/assets/og/baseline-widely-icon.svg",
      },
      theme: themes.high,
    },
    ...features.map(createFeatureCard),
  ];

  const results = await generateOpenGraphCards({
    outputDir,
    cleanOutputDir: true,
    template: "web-features-explorer",
    templates: {
      "web-features-explorer": renderProjectCard,
    },
    cards,
  });

  console.log(`Generated ${results.length} Open Graph images.`);
}

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
