'use strict';
const throatPkg = require('throat');
const createLogger = require('./createLogger');
const makeGetAllResources = require('./getAllResources');
const makeExtractCssResources = require('./extractCssResources');
const makeFetchResource = require('./fetchResource');
const makeExtractCssResourcesFromCdt = require('./extractCssResourcesFromCdt');
const createResourceCache = require('./createResourceCache');
const makeWaitForRenderedStatus = require('./waitForRenderedStatus');
const makePutResources = require('./putResources');
const makeRenderBatch = require('./renderBatch');
const makeOpenEyes = require('./openEyes');
const makeWaitForTestResults = require('./waitForTestResults');
const makeOpenEyesLimitedConcurrency = require('./openEyesLimitedConcurrency');
const getBatch = require('./getBatch');
const {createRenderUtils, authorizationErrMsg, apiKeyFailMsg} = require('./wrapperUtils');

// TODO when supporting only Node version >= 8.6.0 then we can use ...config for all the params that are just passed on to makeOpenEyes
function makeRenderingGridClient({
  showLogs,
  renderStatusTimeout,
  renderStatusInterval,
  concurrency = Infinity,
  renderConcurrencyFactor = 5,
  appName,
  browser = {width: 1024, height: 768},
  apiKey,
  saveDebugData,
  batchName,
  batchId,
  properties,
  baselineBranchName,
  baselineEnvName,
  baselineName,
  envName,
  ignoreCaret,
  isDisabled,
  matchLevel,
  matchTimeout,
  parentBranchName,
  branchName,
  proxy,
  saveFailedTests,
  saveNewTests,
  compareWithParentBranch,
  ignoreBaseline,
  serverUrl,
  wrapper, // for tests
}) {
  if (!apiKey) {
    throw new Error(apiKeyFailMsg);
  }

  const openEyesConcurrency = Number(concurrency);

  if (isNaN(openEyesConcurrency)) {
    throw new Error('concurrency is not a number');
  }

  const renderThroat = throatPkg(openEyesConcurrency * renderConcurrencyFactor);
  const logger = createLogger(showLogs);
  const resourceCache = createResourceCache();
  const fetchCache = createResourceCache();
  const extractCssResources = makeExtractCssResources(logger);
  const fetchResource = makeFetchResource({logger, fetchCache});
  const extractCssResourcesFromCdt = makeExtractCssResourcesFromCdt(extractCssResources);
  const {sendRenderBatch, sendPutResource, getRenderInfo, sendGetRenderStatus} = createRenderUtils({
    apiKey,
    logger,
    serverUrl,
    proxy,
    wrapper,
  });
  const putResources = makePutResources({sendPutResource});
  const renderBatch = makeRenderBatch({
    putResources,
    resourceCache,
    fetchCache,
    logger,
    sendRenderBatch,
  });
  const waitForRenderedStatus = makeWaitForRenderedStatus({
    timeout: renderStatusTimeout,
    getStatusInterval: renderStatusInterval,
    sendGetRenderStatus,
    logger,
  });
  const getAllResources = makeGetAllResources({
    resourceCache,
    extractCssResources,
    fetchResource,
    logger,
  });

  const {batchId: defaultBatchId, batchName: defaultBatchName} = getBatch({batchName, batchId});

  const renderInfoPromise = getRenderInfo().catch(err => {
    if (err.response && err.response.status === 401) {
      err = new Error(authorizationErrMsg);
    }

    return err;
  });

  const openEyes = makeOpenEyes({
    appName,
    browser,
    apiKey,
    saveDebugData,
    batchName: defaultBatchName,
    batchId: defaultBatchId,
    properties,
    baselineBranchName,
    baselineEnvName,
    baselineName,
    envName,
    ignoreCaret,
    isDisabled,
    matchLevel,
    matchTimeout,
    parentBranchName,
    branchName,
    proxy,
    saveFailedTests,
    saveNewTests,
    compareWithParentBranch,
    ignoreBaseline,
    serverUrl,
    logger,
    extractCssResourcesFromCdt,
    renderBatch,
    waitForRenderedStatus,
    getAllResources,
    renderThroat,
    renderInfoPromise,
  });
  const openEyesLimitedConcurrency = makeOpenEyesLimitedConcurrency(openEyes, openEyesConcurrency);
  const waitForTestResults = makeWaitForTestResults({logger});

  return {
    openEyes: openEyesLimitedConcurrency,
    waitForTestResults,
  };
}

module.exports = makeRenderingGridClient;
