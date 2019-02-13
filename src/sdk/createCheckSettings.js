'use strict';
const {CheckSettings, Region} = require('@applitools/eyes-sdk-core');

function createCheckSettings({ignore, floating, layout, strict}) {
  const checkSettings = new CheckSettings(0);
  setEachRegion(ignore, checkSettings.ignoreRegions.bind(checkSettings));
  setEachRegion(layout, checkSettings.layoutRegions.bind(checkSettings));
  setEachRegion(strict, checkSettings.strictRegions.bind(checkSettings));

  if (floating) {
    floating = [].concat(floating);
    for (const region of floating) {
      checkSettings.floatingRegion(
        new Region(region),
        region.maxUpOffset,
        region.maxDownOffset,
        region.maxLeftOffset,
        region.maxRightOffset,
      );
    }
  }

  return checkSettings;

  function setEachRegion(regions, addToSettings) {
    if (regions) {
      regions = [].concat(regions);
      for (const region of regions) {
        addToSettings(new Region(region));
      }
    }
  }
}

module.exports = createCheckSettings;
