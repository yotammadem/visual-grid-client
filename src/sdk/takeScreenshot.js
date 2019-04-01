'use script';

const createLogger = require('./createLogger');
const makeGetAllResources = require('./getAllResources');
const makeExtractCssResources = require('./extractCssResources');
const makeFetchResource = require('./fetchResource');
const createResourceCache = require('./createResourceCache');
const makeWaitForRenderedStatus = require('./waitForRenderedStatus');
const makeGetRenderStatus = require('./getRenderStatus');
const makePutResources = require('./putResources');
const makeRenderBatch = require('./renderBatch');
const makeCreateRGridDOMAndGetResourceMapping = require('./createRGridDOMAndGetResourceMapping');
const getRenderMethods = require('./getRenderMethods');
const {createRenderWrapper} = require('./wrapperUtils');
const {ptimeoutWithError} = require('@applitools/functional-commons');
const createRenderRequests = require('./createRenderRequests');

require('@applitools/isomorphic-fetch'); // TODO can just use node-fetch

const fetchResourceTimeout = 120000;

async function takeScreenshot({
  showLogs,
  apiKey,
  serverUrl,
  proxy,
  renderInfo,
  cdt,
  url,
  resourceUrls,
  blobs,
  frames,
  browsers = [{width: 1024, height: 768}],
  sizeMode = 'full-page',
  // selector,
  // region,
  // scriptHooks,
}) {
  const resourceContents = blobs.map(({url, type, value}) => ({
    url,
    type,
    value: Buffer.from(value, 'base64'),
  }));

  const {createRGridDOMAndGetResourceMapping, renderBatch, waitForRenderedStatus} = makeRenderer({
    apiKey,
    showLogs,
    serverUrl,
    proxy,
    renderInfo,
  });

  const {rGridDom: dom, allResources: resources} = await createRGridDOMAndGetResourceMapping({
    resourceUrls,
    resourceContents,
    cdt,
    url,
    frames,
  });

  const renderRequests = createRenderRequests({
    url,
    dom,
    resources: Object.values(resources),
    browsers,
    webhook: renderInfo.ResultsUrl,
    sizeMode,
    // selector,
    // region,
    // scriptHooks,
    sendDom: true,
  });

  const renderIds = await renderBatch(renderRequests);

  const renderStatusResults = await Promise.all(
    renderIds.map(renderId => waitForRenderedStatus(renderId, () => false)),
  );

  return renderStatusResults.map(({imageLocation}) => imageLocation);
}

function makeRenderer({apiKey, showLogs, serverUrl, proxy, renderInfo}) {
  const logger = createLogger(showLogs);

  const renderWrapper = createRenderWrapper({
    apiKey,
    logHandler: logger.getLogHandler(),
    serverUrl,
    proxy,
  });

  const {doRenderBatch, doPutResource, doGetRenderStatus} = getRenderMethods(renderWrapper);
  renderWrapper.setRenderingInfo({
    getAccessToken: () => renderInfo.AccessToken,
    getServiceUrl: () => renderInfo.ServiceUrl,
    getResultsUrl: () => renderInfo.ResultsUrl,
  }); // TODO this is a hack

  const resourceCache = createResourceCache();
  const fetchCache = createResourceCache();
  const extractCssResources = makeExtractCssResources(logger);
  const fetchWithTimeout = url =>
    ptimeoutWithError(fetch(url), fetchResourceTimeout, 'fetche timed out');
  const fetchResource = makeFetchResource({logger, fetchCache, fetch: fetchWithTimeout});
  const putResources = makePutResources({doPutResource});
  const renderBatch = makeRenderBatch({
    putResources,
    resourceCache,
    fetchCache,
    logger,
    doRenderBatch,
  });
  const getRenderStatus = makeGetRenderStatus({logger, doGetRenderStatus});
  const waitForRenderedStatus = makeWaitForRenderedStatus({logger, getRenderStatus});
  const getAllResources = makeGetAllResources({
    resourceCache,
    extractCssResources,
    fetchResource,
    logger,
  });
  const createRGridDOMAndGetResourceMapping = makeCreateRGridDOMAndGetResourceMapping({
    getAllResources,
  });

  return {createRGridDOMAndGetResourceMapping, renderBatch, waitForRenderedStatus};
}

module.exports = takeScreenshot;
