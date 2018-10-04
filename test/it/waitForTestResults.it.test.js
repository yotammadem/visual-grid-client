'use strict';
const {describe, it, before, after, beforeEach, afterEach} = require('mocha');
const {expect} = require('chai');
const testServer = require('../util/testServer');
const makeRenderingGridClient = require('../../src/sdk/renderingGridClient');
const nock = require('nock');
const createFakeWrapper = require('../util/createFakeWrapper');
const {presult} = require('@applitools/functional-commons');

describe('waitForTestResults', () => {
  const apiKey = 'some api key';

  let baseUrl, closeServer;
  before(async () => {
    const server = await testServer({port: 3456}); // TODO fixed port avoids 'need-more-resources' for dom. Is this desired? should both paths be tested?
    baseUrl = `http://localhost:${server.port}`;
    closeServer = server.close;
  });

  after(async () => {
    await closeServer();
  });

  let wrapper;
  beforeEach(() => {
    wrapper = createFakeWrapper(baseUrl);

    nock(wrapper.baseUrl)
      .persist()
      .post(wrapper.resultsRoute)
      .reply(201, '', {location: 'uploaded_location'});
  });

  let prevEnv;
  beforeEach(() => {
    prevEnv = process.env;
    process.env = {};
  });

  afterEach(() => {
    process.env = prevEnv;
  });

  it('returns errors and results', async () => {
    const {openEyes, waitForTestResults} = makeRenderingGridClient({
      showLogs: process.env.APPLITOOLS_SHOW_LOGS,
      apiKey,
      wrapper,
    });

    const {checkWindow, close} = await openEyes({
      wrappers: [wrapper],
    });

    const errMsg = 'Tag bad should be one of the good tags good1,good2';

    checkWindow({cdt: [], url: '', tag: 'bad'});
    const closePromise = close();
    expect((await presult(closePromise))[0].message).to.equal(errMsg);

    const {checkWindow: checkWindow2, close: close2} = await openEyes({
      wrappers: [wrapper],
    });

    checkWindow2({cdt: [], url: ''});
    const closePromise2 = close2();

    const {checkWindow: checkWindow3, close: close3} = await openEyes({
      wrappers: [wrapper],
      isDisabled: true,
    });

    checkWindow3({cdt: [], url: ''});
    const closePromise3 = close3();

    const [err, results, skipped] = await waitForTestResults([
      closePromise,
      closePromise2,
      closePromise3,
    ]);
    expect(err.message).to.equal(errMsg);
    expect(results.map(r => r.getAsExpected())[0]).to.equal(true);
    expect(skipped).to.equal(undefined);
  });
});
