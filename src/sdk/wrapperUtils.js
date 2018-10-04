'use strict';
const EyesWrapper = require('./EyesWrapper');
const {BatchInfo, RectangleSize} = require('@applitools/eyes.sdk.core');

function initWrappers({count, apiKey, logHandler}) {
  return Array.from(new Array(count), () => new EyesWrapper({apiKey, logHandler}));
}

function validateAndAddProperties(wrapper, properties) {
  if (properties) {
    if (Array.isArray(properties)) {
      properties.forEach(prop => {
        if (typeof prop === 'object') {
          wrapper.addProperty(prop.name, prop.value);
        } else {
          throw new Error(`${propertiesFailMsg}. Type of property inside array was ${typeof prop}`);
        }
      });
    } else {
      throw new Error(`${propertiesFailMsg}. Type of properties argument was ${typeof properties}`);
    }
  }
}

function configureWrappers(wrappers, config) {
  const batchInfo = new BatchInfo(config.batchName, null, config.batchId);
  for (const wrapper of wrappers) {
    configureWrapper(wrapper, Object.assign({batchInfo, config}));
  }
}

function configureWrapper(
  wrapper,
  {
    isDisabled,
    batchInfo,
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
  },
) {
  validateAndAddProperties(wrapper, properties);
  wrapper.setBatch(batchInfo);

  baselineBranchName !== undefined && wrapper.setBaselineBranchName(baselineBranchName);
  baselineEnvName !== undefined && wrapper.setBaselineEnvName(baselineEnvName);
  baselineName !== undefined && wrapper.setBaselineName(baselineName);
  envName !== undefined && wrapper.setEnvName(envName);
  ignoreCaret !== undefined && wrapper.setIgnoreCaret(ignoreCaret);
  isDisabled !== undefined && wrapper.setIsDisabled(isDisabled);
  matchLevel !== undefined && wrapper.setMatchLevel(matchLevel);
  matchTimeout !== undefined && wrapper.setMatchTimeout(matchTimeout);
  parentBranchName !== undefined && wrapper.setParentBranchName(parentBranchName);
  branchName !== undefined && wrapper.setBranchName(branchName);
  proxy !== undefined && wrapper.setProxy(proxy);
  saveFailedTests !== undefined && wrapper.setSaveFailedTests(saveFailedTests);
  saveNewTests !== undefined && wrapper.setSaveNewTests(saveNewTests);
  compareWithParentBranch !== undefined &&
    wrapper.setCompareWithParentBranch(compareWithParentBranch);
  ignoreBaseline !== undefined && wrapper.setIgnoreBaseline(ignoreBaseline);
  serverUrl !== undefined && wrapper.setServerUrl(serverUrl);
}

function openWrappers({wrappers, browsers, appName, testName}) {
  return Promise.all(
    wrappers.map((wrapper, i) => {
      const viewportSize = browsers[i].width && new RectangleSize(browsers[i]);
      return wrapper.open(appName, testName, viewportSize);
    }),
  );
}

function createRenderUtils({serverUrl, proxy, apiKey, logger, wrapper}) {
  wrapper = wrapper || new EyesWrapper({apiKey, logHandler: logger.getLogHandler()});
  configureWrapper(wrapper, {serverUrl, proxy});

  const sendRenderBatch = wrapper.renderBatch.bind(wrapper);
  const sendPutResource = wrapper.putResource.bind(wrapper);
  const getRenderInfo = wrapper.getRenderInfo.bind(wrapper);
  const sendGetRenderStatus = wrapper.getRenderStatus.bind(wrapper);

  return {
    sendRenderBatch,
    sendPutResource,
    getRenderInfo,
    sendGetRenderStatus,
  };
}

const apiKeyFailMsg =
  'APPLITOOLS_API_KEY env variable is not defined. It is required to define this variable when running Cypress for Applitools visual tests to run successfully.';

const propertiesFailMsg =
  'Argument "properties" should be an array of objects, each one with a "name" and "value" properties';

const authorizationErrMsg = 'Unauthorized access to Eyes server. Please check your API key.';

module.exports = {
  initWrappers,
  configureWrappers,
  openWrappers,
  createRenderUtils,
  apiKeyFailMsg,
  propertiesFailMsg,
  authorizationErrMsg,
};
