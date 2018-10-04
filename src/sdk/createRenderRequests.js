'use strict';

const {RenderRequest, RenderInfo} = require('@applitools/eyes.sdk.core');
const createRGridDom = require('./createRGridDom');
const createEmulationInfo = require('./createEmulationInfo');
const calculateSelectorsToFindRegionsFor = require('./calculateSelectorsToFindRegionsFor');

function createRenderRequests({
  url,
  resources,
  cdt,
  browsers,
  webhook,
  sizeMode,
  selector,
  region,
  scriptHooks,
  ignore,
  floating,
  sendDom,
}) {
  const rGridDom = createRGridDom({resources, cdt});
  const selectorsToFindRegionsFor = calculateSelectorsToFindRegionsFor({
    sizeMode,
    selector,
    ignore,
    floating,
  });

  return browsers.map(
    ({width, height, name, deviceName, screenOrientation, deviceScaleFactor, mobile}) => {
      const emulationInfo = createEmulationInfo({
        deviceName,
        screenOrientation,
        deviceScaleFactor,
        mobile,
        width,
        height,
      });

      return new RenderRequest(
        webhook,
        url,
        rGridDom,
        RenderInfo.fromObject({width, height, sizeMode, selector, region, emulationInfo}),
        'Linux',
        name,
        scriptHooks,
        selectorsToFindRegionsFor,
        sendDom,
      );
    },
  );
}

module.exports = createRenderRequests;
