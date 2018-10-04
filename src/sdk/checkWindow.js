'use strict';
const absolutizeUrl = require('./absolutizeUrl');
const mapKeys = require('lodash.mapkeys');
const mapValues = require('lodash.mapvalues');
const saveData = require('../troubleshoot/saveData');
const createRenderRequests = require('./createRenderRequests');
const createCheckSettings = require('./createCheckSettings');
const {presult} = require('@applitools/functional-commons');
const {RectangleSize, Location} = require('@applitools/eyes.sdk.core');
const calculateIgnoreAndFloatingRegions = require('./calculateIgnoreAndFloatingRegions');

function makeCheckWindow({
  getError,
  saveDebugData,
  extractCssResourcesFromCdt,
  renderBatch,
  waitForRenderedStatus,
  getAllResources,
  webhook,
  logger,
  getCheckWindowPromises,
  setCheckWindowPromises,
  browsers,
  setError,
  wrappers,
  renderThroat,
  stepCounter,
  testName,
}) {
  return function checkWindow({
    resourceUrls = [],
    resourceContents = {},
    url,
    cdt,
    tag,
    sizeMode = 'full-page',
    selector,
    region,
    scriptHooks,
    ignore,
    floating,
    sendDom = true,
  }) {
    logger.log(`running checkWindow for test ${testName} step #${++stepCounter}`);
    if (getError()) {
      logger.log('aborting checkWindow synchronously');
      return;
    }
    const resourceUrlsWithCss = resourceUrls.concat(extractCssResourcesFromCdt(cdt, url));
    const absoluteUrls = resourceUrlsWithCss.map(resourceUrl => absolutizeUrl(resourceUrl, url));
    const absoluteResourceContents = mapValues(
      mapKeys(resourceContents, (_value, key) => absolutizeUrl(key, url)),
      ({url: resourceUrl, type, value}) => ({url: absolutizeUrl(resourceUrl, url), type, value}),
    );

    const getResourcesPromise = getAllResources(absoluteUrls, absoluteResourceContents);
    const renderPromise = presult(startRender());

    let renderJobs; // This will be an array of `resolve` functions to rendering jobs. See `createRenderJob` below.

    setCheckWindowPromises(
      browsers.map((_browser, i) => checkWindowJob(getCheckWindowPromises()[i], i).catch(setError)),
    );

    async function checkWindowJob(prevJobPromise = presult(Promise.resolve()), index) {
      if (getError()) {
        logger.log(
          `aborting checkWindow - not waiting for render to complete (so no renderId yet)`,
        );
        return;
      }

      const [renderErr, renderIds] = await renderPromise;

      if (getError()) {
        logger.log(
          `aborting checkWindow after render request complete but before waiting for rendered status`,
        );
        return;
      }

      if (renderErr) {
        setError(renderErr);
        return;
      }

      const renderId = renderIds[index];

      logger.log(
        `render request complete for ${renderId}. test=${testName} stepCount=${stepCounter} tag=${tag} sizeMode=${sizeMode} browser: ${JSON.stringify(
          browsers[index],
        )}`,
      );
      const {
        imageLocation: screenshotUrl,
        domLocation,
        userAgent,
        deviceSize,
        selectorRegions,
      } = await waitForRenderedStatus(renderId, getError);

      if (screenshotUrl) {
        logger.log(`screenshot available for ${renderId} at ${screenshotUrl}`);
      } else {
        logger.log(`screenshot NOT available for ${renderId}`);
      }

      if (renderJobs) {
        renderJobs[index]();
      }

      const wrapper = wrappers[index];
      wrapper.setInferredEnvironment(`useragent:${userAgent}`);
      if (deviceSize) {
        wrapper.setViewportSize(RectangleSize.fromObject(deviceSize));
      }

      logger.log(`checkWindow waiting for prev job. test=${testName}, stepCount=${stepCounter}`);

      await prevJobPromise;

      if (getError()) {
        logger.log(
          `aborting checkWindow for ${renderId} because there was an error in some previous job`,
        );
        return;
      }

      const imageLocationRegion = sizeMode === 'selector' ? selectorRegions[0] : undefined;
      const imageLocation = imageLocationRegion
        ? Location.fromObject({x: imageLocationRegion.getLeft(), y: imageLocationRegion.getTop()})
        : undefined;

      const {ignoreRegions, floatingRegions} = calculateIgnoreAndFloatingRegions({
        ignore,
        floating,
        selectorRegions,
        imageLocationRegion,
      });

      const checkSettings = createCheckSettings({ignore: ignoreRegions, floating: floatingRegions});

      logger.log(`running wrapper.checkWindow for test ${testName} stepCount #${stepCounter}`);
      await wrapper.checkWindow({
        screenshotUrl,
        tag,
        domUrl: domLocation,
        checkSettings,
        imageLocation,
      });
    }

    async function startRender() {
      if (getError()) {
        logger.log(`aborting startRender because there was an error in getRenderInfo`);
        return;
      }

      const resources = await getResourcesPromise;

      if (getError()) {
        logger.log(`aborting startRender because there was an error in getAllResources`);
        return;
      }

      const renderRequests = createRenderRequests({
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
      });

      let renderIds = await renderThroat(() => renderBatch(renderRequests));
      renderJobs = renderIds.map(createRenderJob);

      if (saveDebugData) {
        for (const renderId of renderIds) {
          await saveData({renderId, cdt, resources, url, logger});
        }
      }

      return renderIds;
    }
  };

  /**
   * Run a function down the renderThroat and return a way to resolve it. Once resolved (in another place) it makes room in the throat for the next renders that
   */
  function createRenderJob() {
    let resolve;
    const p = new Promise(res => (resolve = res));
    renderThroat(() => p);
    return resolve;
  }
}

module.exports = makeCheckWindow;
