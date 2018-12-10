'use strict';
const {describe, it} = require('mocha');
const {expect} = require('chai');
const nock = require('nock');
const makeFetchResource = require('../../../src/sdk/fetchResource');
const testLogger = require('../../util/testLogger');
const psetTimeout = require('util').promisify(setTimeout);
const FetchError = require('isomorphic-fetch/node_modules/node-fetch/lib/fetch-error');
const createResourceCache = require('../../../src/sdk/createResourceCache');

describe('fetchResource', () => {
  it('fetches with content and content-type', async () => {
    const fetchResource = makeFetchResource({logger: testLogger, retries: 0});
    const url = 'http://something';
    nock(url)
      .get('/')
      .reply(200, 'bla', {'content-type': 'some/content-type'});

    const resource = await fetchResource(url);
    expect(resource).to.eql({url, type: 'some/content-type', value: Buffer.from('bla')});
  });

  it('fetches with retries', async () => {
    const fetchResourceWithRetry = makeFetchResource({logger: testLogger, retries: 3});
    const fetchResourceWithoutRetry = makeFetchResource({logger: testLogger, retries: 0});
    const url = 'http://something';
    const type = 'some/content-type';
    const p1 = fetchResourceWithRetry(url).then(resource => {
      expect(resource).to.eql({url, type, value: Buffer.from('bla')});
    });
    const p2 = fetchResourceWithoutRetry(url).catch(err => {
      expect(err).to.be.an.instanceof(FetchError);
    });
    await psetTimeout(50);
    nock(url)
      .get('/')
      .reply(200, 'bla', {'content-type': type});

    await Promise.all([p1, p2]);
  });

  it('caches requests', async () => {
    const fetchCache = createResourceCache();
    const fetchResource = makeFetchResource({logger: testLogger, retries: 0, fetchCache});
    const url = 'http://something';
    let counter = 0;
    nock(url)
      .get('/')
      .times(2)
      .reply(200, () => ++counter, {'content-type': 'some/content-type'});

    const r1 = await fetchResource(url);
    const r2 = await fetchResource(url);
    expect(r1).to.eql(r2);
  });
});
