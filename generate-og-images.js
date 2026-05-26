import fs from "node:fs/promises";
import path from "node:path";
import { generateOpenGraphCards } from "@schalkneethling/opengraph-cards-maker";
import { browsers, features } from "web-features";
import siteConfig from "./site.config.js";

const { openGraph } = siteConfig;
const outputDir = path.resolve(openGraph.outputDir);
const featureOutputDir = path.resolve(openGraph.featureOutputDir);
const templatePath = path.resolve("site/_includes/og-card-template.html");
const cardBrowsers = ["chrome", "edge", "firefox", "safari"].map((id) => ({
  id,
  name: browsers[id].name,
  icon: openGraph.browserIcons[id],
}));
let cardTemplate = "";

function formatBaselineDate(date = "") {
  return date.startsWith("≤") ? `before ${date.slice(1)}` : date;
}

function getStatus(feature) {
  const { status } = openGraph.strings;

  if (feature.discouraged) {
    return {
      label: status.discouraged.label,
      detail: feature.discouraged.reason || status.discouraged.fallbackDetail,
      icon: null,
      theme: openGraph.themes.discouraged,
    };
  }

  if (feature.status?.baseline === "high") {
    return {
      label: status.high.label,
      detail: `${status.high.detailPrefix}${formatBaselineDate(feature.status.baseline_high_date)}`,
      icon: status.high.icon,
      theme: openGraph.themes.high,
    };
  }

  if (feature.status?.baseline === "low") {
    return {
      label: status.low.label,
      detail: `${status.low.detailPrefix}${formatBaselineDate(feature.status.baseline_low_date)}`,
      icon: status.low.icon,
      theme: openGraph.themes.low,
    };
  }

  return {
    label: status.limited.label,
    detail: status.limited.detail,
    icon: status.limited.icon,
    theme: openGraph.themes.limited,
  };
}

function replaceTemplateValue(template, key, value) {
  return template.replace(key, value);
}

function renderProjectCard({ card, images, size, escapeHTML }) {
  const fallbackTheme = openGraph.themes.high;
  const theme = {
    accent: card.theme?.accent ?? fallbackTheme.accent,
    accentBackground:
      card.theme?.accentBackground ?? fallbackTheme.accentBackground,
    accentBorder: card.theme?.accentBorder ?? fallbackTheme.accentBorder,
  };

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

  return [
    ["--card-width: 1200px;", `--card-width: ${size.width}px;`],
    ["--card-height: 630px;", `--card-height: ${size.height}px;`],
    ["--accent: #34a853;", `--accent: ${theme.accent};`],
    ["--accent-bg: #e6f4ea;", `--accent-bg: ${theme.accentBackground};`],
    ["--accent-border: #b7dfc0;", `--accent-border: ${theme.accentBorder};`],
    [
      "<!-- BRAND_IMAGE -->",
      images.brand ? `<img class="brand" src="${images.brand}" alt="">` : "",
    ],
    ["<!-- CARD_TITLE -->", escapeHTML(card.title)],
    ["<!-- CARD_DESCRIPTION -->", escapeHTML(card.description)],
    ["<!-- STATUS_HTML -->", status],
    ["<!-- SUPPORT_HTML -->", support],
  ].reduce(
    (template, [key, value]) => replaceTemplateValue(template, key, value),
    cardTemplate,
  );
}

function getSupportLabel(feature, browserId) {
  const version = feature.status?.support?.[browserId];
  if (!version) {
    return openGraph.strings.support.noSupport;
  }

  return version.startsWith("≤")
    ? version
    : `${openGraph.strings.support.versionPrefix}${version}`;
}

function getSupport(feature) {
  return cardBrowsers.map((browser) => {
    const version = feature.status?.support?.[browser.id];

    return {
      name: browser.name,
      detail: getSupportLabel(feature, browser.id),
      supported: Boolean(version),
      icon: browser.icon,
    };
  });
}

function createFeatureCard(id, feature) {
  const status = getStatus(feature);

  return {
    id,
    outputPath: path.join(featureOutputDir, `${id}.png`),
    eyebrow: "Web platform features explorer",
    title: feature.name,
    description: feature.description || openGraph.strings.defaultDescription,
    brand: {
      src: openGraph.brandSrc,
    },
    status: {
      label: status.label,
      detail: status.detail,
      icon: status.icon,
    },
    support: getSupport(feature),
    theme: status.theme,
  };
}

async function generate() {
  cardTemplate = await fs.readFile(templatePath, "utf8");

  const featureCards = Object.entries(features)
    .filter(([, feature]) => feature.kind === "feature")
    .map(([id, feature]) => createFeatureCard(id, feature));

  const cards = [
    {
      id: "default",
      brand: {
        src: openGraph.brandSrc,
      },
      title: openGraph.strings.defaultTitle,
      description: openGraph.strings.defaultDescription,
      status: {
        label: openGraph.strings.defaultStatus.label,
        detail: openGraph.strings.defaultStatus.detail,
        icon: openGraph.strings.defaultStatus.icon,
      },
      theme: openGraph.themes.high,
    },
    ...featureCards,
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
