import { features as rawFeatureData } from "web-features";

export const features = new Proxy(rawFeatureData, {
  get(target, property) {
    if (target[property].kind !== "feature") {
      console.trace(`\`${property}\` is a redirect, not an ordinary feature`);
    }
    return Reflect.get(...arguments)
  }
});
