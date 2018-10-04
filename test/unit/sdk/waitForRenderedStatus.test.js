'use strict';
const {describe, it} = require('mocha');
const {expect} = require('chai');
const {RenderStatusResults, RenderStatus} = require('@applitools/eyes.sdk.core');
const testLogger = require('../../util/testLogger');
const makeWaitForRenderedStatus = require('../../../src/sdk/waitForRenderedStatus');
const psetTimeout = require('util').promisify(setTimeout);

describe('waitForRenderedStatus', () => {
  it('works', async () => {
    const renderId = 'some render';
    const renderStatus = {
      status: RenderStatus.RENDERED,
      imageLocation: renderId,
    };

    const sendGetRenderStatus = async () => {
      await psetTimeout(200);
      return [RenderStatusResults.fromObject(renderStatus)];
    };

    const waitForRenderedStatus = makeWaitForRenderedStatus({
      timeout: 1000,
      getStatusInterval: 50,
      logger: testLogger,
      sendGetRenderStatus,
    });

    const result = await waitForRenderedStatus(renderId, () => {});
    expect(result).to.eql(
      Object.assign(renderStatus, {
        deviceSize: undefined,
        domLocation: undefined,
        error: undefined,
        os: undefined,
        selectorRegions: undefined,
        userAgent: undefined,
      }),
    );
  });

  it('works', async () => {
    const renderId = 'some render';
    const renderStatus = {
      status: RenderStatus.RENDERED,
      imageLocation: renderId,
    };

    const sendGetRenderStatus = async () => {
      await psetTimeout(200);
      return [RenderStatusResults.fromObject(renderStatus)];
    };

    const waitForRenderedStatus = makeWaitForRenderedStatus({
      timeout: 1000,
      getStatusInterval: 50,
      logger: testLogger,
      sendGetRenderStatus,
    });

    const result = await waitForRenderedStatus(renderId, () => {});
    expect(result).to.eql(
      Object.assign(renderStatus, {
        deviceSize: undefined,
        domLocation: undefined,
        error: undefined,
        os: undefined,
        selectorRegions: undefined,
        userAgent: undefined,
      }),
    );
  });
});
