// This is where all the data that's mapped to web-features comes from.
// See https://github.com/web-platform-dx/web-features-mappings
export const WEB_FEATURES_MAPPINGS_URL = "https://raw.githubusercontent.com/web-platform-dx/web-features-mappings/refs/heads/main/mappings/combined-data.json";

// Number of months after Baseline low that Baseline high happens.
// Keep in sync with definition at:
// https://github.com/web-platform-dx/web-features/blob/main/docs/baseline.md#wider-support-high-status
export const BASELINE_LOW_TO_HIGH_DURATION = 30;

// Used to display the list of features that are implemented in only one browser engine.
export const BROWSERS_BY_ENGINE = [
  {
    name: "Chromium",
    browers: ["chrome", "chrome_android", "edge"]
  },
  {
    name: "Firefox",
    browers: ["firefox", "firefox_android"]
  },
  {
    name: "Safari",
    browers: ["safari", "safari_ios"]
  }
];
