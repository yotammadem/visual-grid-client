'use strict';
const makeCheckWindow = require('./checkWindow');
const makeCloseEyes = require('./closeEyes');
const {initWrappers, configureWrappers, openWrappers} = require('./wrapperUtils');

function makeOpenEyes({
  appName: _appName,
  browser: _browser,
  saveDebugData: _saveDebugData,
  batchName: _batchName,
  batchId: _batchId,
  properties: _properties,
  baselineBranchName: _baselineBranchName,
  baselineEnvName: _baselineEnvName,
  baselineName: _baselineName,
  envName: _envName,
  ignoreCaret: _ignoreCaret,
  isDisabled: _isDisabled,
  matchLevel: _matchLevel,
  matchTimeout: _matchTimeout,
  parentBranchName: _parentBranchName,
  branchName: _branchName,
  proxy: _proxy,
  saveFailedTests: _saveFailedTests,
  saveNewTests: _saveNewTests,
  compareWithParentBranch: _compareWithParentBranch,
  ignoreBaseline: _ignoreBaseline,
  serverUrl,
  apiKey,
  logger,
  extractCssResourcesFromCdt,
  renderBatch,
  waitForRenderedStatus,
  getAllResources,
  renderThroat,
  renderInfoPromise,
}) {
  return async function openEyes({
    testName,
    wrappers,
    appName = _appName,
    browser = _browser,
    saveDebugData = _saveDebugData,
    batchName = _batchName,
    batchId = _batchId,
    properties = _properties,
    baselineBranchName = _baselineBranchName,
    baselineEnvName = _baselineEnvName,
    baselineName = _baselineName,
    envName = _envName,
    ignoreCaret = _ignoreCaret,
    isDisabled = _isDisabled,
    matchLevel = _matchLevel,
    matchTimeout = _matchTimeout,
    parentBranchName = _parentBranchName,
    branchName = _branchName,
    proxy = _proxy,
    saveFailedTests = _saveFailedTests,
    saveNewTests = _saveNewTests,
    compareWithParentBranch = _compareWithParentBranch,
    ignoreBaseline = _ignoreBaseline,
  }) {
    let error;

    if (isDisabled) {
      logger.log('openEyes: isDisabled=true, skipping checks');
      return {
        checkWindow: disabledFunc('checkWindow'),
        close: disabledFunc('close'),
        abort: disabledFunc('abort'),
      };
    }

    let checkWindowPromises = [];

    const browsers = Array.isArray(browser) ? browser : [browser];
    wrappers =
      wrappers ||
      initWrappers({count: browsers.length, apiKey, logHandler: logger.getLogHandler()});

    configureWrappers(wrappers, {
      isDisabled,
      batchName,
      batchId,
      properties,
      baselineBranchName,
      baselineEnvName,
      baselineName,
      envName,
      ignoreCaret,
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
    });

    const [renderInfo] = await Promise.all([
      renderInfoPromise,
      openWrappers({wrappers, browsers, appName, testName}),
    ]);

    if (renderInfo instanceof Error) {
      throw renderInfo;
    }

    const webhook = renderInfo.getResultsUrl();

    let stepCounter = 0;

    const checkWindow = makeCheckWindow({
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
    });

    const close = makeCloseEyes({getError, logger, getCheckWindowPromises, wrappers});

    return {
      checkWindow,
      close,
      abort,
    };

    function setError(err) {
      logger.log('error set in test', testName, err);
      error = err;
    }

    function getError() {
      return error;
    }

    function getCheckWindowPromises() {
      return checkWindowPromises;
    }

    function setCheckWindowPromises(promises) {
      checkWindowPromises = promises;
    }

    function disabledFunc(name) {
      return async () => {
        logger.log(`${name}: isDisabled=true, skipping checks`);
      };
    }

    function abort() {
      return Promise.all(wrappers.map(wrapper => wrapper.abortIfNotClosed()));
    }
  };
}

module.exports = makeOpenEyes;
