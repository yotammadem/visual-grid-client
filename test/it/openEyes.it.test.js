'use strict';
const {describe, it, before, after, beforeEach, afterEach} = require('mocha');
const {expect} = require('chai');
const makeRenderingGridClient = require('../../src/sdk/renderingGridClient');
const FakeEyesWrapper = require('../util/FakeEyesWrapper');
const createFakeWrapper = require('../util/createFakeWrapper');
const testServer = require('../util/testServer');
const {loadJsonFixture, loadFixtureBuffer} = require('../util/loadFixture');
const {promisify: p} = require('util');
const nock = require('nock');
const psetTimeout = p(setTimeout);
const {presult} = require('@applitools/functional-commons');
const {
  RenderStatus,
  RenderStatusResults,
  Region,
  IgnoreRegionByRectangle,
  FloatingRegionByRectangle,
} = require('@applitools/eyes.sdk.core');
const {apiKeyFailMsg, authorizationErrMsg} = require('../../src/sdk/wrapperUtils');

describe('openEyes', () => {
  let baseUrl, closeServer, wrapper, openEyes, prevEnv;
  const apiKey = 'some api key';

  before(async () => {
    const server = await testServer({port: 3456}); // TODO fixed port avoids 'need-more-resources' for dom. Is this desired? should both paths be tested?
    baseUrl = `http://localhost:${server.port}`;
    closeServer = server.close;
  });

  after(async () => {
    await closeServer();
  });

  beforeEach(() => {
    const {APPLITOOLS_SHOW_LOGS} = process.env;
    prevEnv = process.env;
    process.env = {};

    wrapper = createFakeWrapper(baseUrl);

    openEyes = makeRenderingGridClient({showLogs: APPLITOOLS_SHOW_LOGS, wrapper, apiKey}).openEyes;

    nock(wrapper.baseUrl)
      .persist()
      .post(wrapper.resultsRoute)
      .reply(201, (_url, body) => body, {
        location: (_req, _res, body) => body,
      });
  });

  afterEach(() => {
    process.env = prevEnv;
  });

  it("doesn't throw exception", async () => {
    const {checkWindow, close} = await openEyes({
      wrappers: [wrapper],
    });

    checkWindow({cdt: [], tag: 'good1', url: `${baseUrl}/test.html`});
    expect((await close())[0].map(r => r.getAsExpected())).to.eql([true]);
  });

  it('throws with bad tag', async () => {
    const {checkWindow, close} = await openEyes({
      wrappers: [wrapper],
    });
    checkWindow({cdt: [], resourceUrls: [], tag: 'bad!', url: `${baseUrl}/test.html`});
    await psetTimeout(0); // because FakeEyesWrapper throws, and then the error is set async and will be read in the next call to close()
    expect((await presult(close()))[0].message).to.equal(
      `Tag bad! should be one of the good tags good1,good2`,
    );
  });

  it('passes with correct dom', async () => {
    const {checkWindow, close} = await openEyes({
      wrappers: [wrapper],
    });

    const resourceUrls = wrapper.goodResourceUrls;
    const cdt = loadJsonFixture('test.cdt.json');
    checkWindow({resourceUrls, cdt, tag: 'good1', url: `${baseUrl}/test.html`});

    expect((await close())[0].map(r => r.getAsExpected())).to.eql([true]);
  });

  it('fails with incorrect dom', async () => {
    const {checkWindow, close} = await openEyes({
      wrappers: [wrapper],
    });
    const resourceUrls = ['smurfs.jpg', 'test.css'];
    const cdt = loadJsonFixture('test.cdt.json');
    cdt.find(node => node.nodeValue === "hi, I'm red").nodeValue = "hi, I'm green";

    checkWindow({resourceUrls, cdt, tag: 'good1', url: `${baseUrl}/test.html`});

    expect((await presult(close()))[0].message).to.equal('mismatch');
  });

  it('renders multiple viewport sizes', async () => {
    const {checkWindow, close} = await openEyes({
      wrappers: [
        createFakeWrapper(baseUrl),
        createFakeWrapper(baseUrl),
        createFakeWrapper(baseUrl),
      ],
      browser: [{width: 320, height: 480}, {width: 640, height: 768}, {width: 1600, height: 900}],
    });

    const resourceUrls = wrapper.goodResourceUrls;
    const cdt = loadJsonFixture('test.cdt.json');
    checkWindow({resourceUrls, cdt, tag: 'good1', url: `${baseUrl}/test.html`});
    expect(
      (await close()).map(wrapperResult => wrapperResult.map(r2 => r2.getAsExpected())),
    ).to.eql([[true], [true], [true]]);
  });

  it('handles `batchName` and `batchId` param', async () => {
    const batchName = `some batch name ${Date.now()}`;
    const batchId = `some batch ID ${Date.now()}`;
    await openEyes({
      wrappers: [wrapper],
      batchName,
      batchId,
    });

    expect(wrapper.getBatch().getName()).to.equal(batchName);
    expect(wrapper.getBatch().getId()).to.equal(batchId);
  });

  it('renders the correct sizeMode', async () => {
    const {checkWindow, close} = await openEyes({
      wrappers: [wrapper],
      browser: {width: 320, height: 480},
    });

    const resourceUrls = wrapper.goodResourceUrls;
    const cdt = loadJsonFixture('test.cdt.json');
    checkWindow({
      resourceUrls,
      cdt,
      tag: 'good1',
      sizeMode: 'some size mode',
      url: `${baseUrl}/test.html`,
    });
    expect((await close())[0].map(r => r.getAsExpected())).to.eql([true]);
  });

  it('runs matchWindow in the correct order', async () => {
    const wrapper1 = new FakeEyesWrapper({goodFilename: 'test.cdt.json', goodResourceUrls: []});
    const wrapper2 = new FakeEyesWrapper({goodFilename: 'test.cdt.json', goodResourceUrls: []});

    wrapper1.checkWindow = async function({tag}) {
      if (tag === 'one') {
        await psetTimeout(200);
      } else if (tag === 'two') {
        await psetTimeout(50);
      }
      this.results.push(`${tag}1`);
    };

    wrapper2.checkWindow = async function({tag}) {
      if (tag === 'one') {
        await psetTimeout(150);
      } else if (tag === 'two') {
        await psetTimeout(150);
      }
      this.results.push(`${tag}2`);
    };

    wrapper1.close = wrapper2.close = function() {
      return this.results;
    };

    const {checkWindow, close} = await openEyes({
      wrappers: [wrapper1, wrapper2],
      browser: [{width: 320, height: 480}, {width: 640, height: 768}],
    });

    const resourceUrls = wrapper.goodResourceUrls;
    const cdt = loadJsonFixture('test.cdt.json');
    checkWindow({resourceUrls, cdt, tag: 'one', url: `${baseUrl}/test.html`});
    checkWindow({resourceUrls, cdt, tag: 'two', url: `${baseUrl}/test.html`});
    checkWindow({resourceUrls, cdt, tag: 'three', url: `${baseUrl}/test.html`});
    expect(await close()).to.eql([['one1', 'two1', 'three1'], ['one2', 'two2', 'three2']]);
  });

  it('handles resourceContents in checkWindow', async () => {
    const {checkWindow, close} = await openEyes({
      wrappers: [wrapper],
    });

    const blobUrl = `blob.css`;
    const resourceContents = {
      [blobUrl]: {
        url: blobUrl,
        type: 'text/css',
        value: loadFixtureBuffer('blob.css'),
      },
    };

    wrapper.goodResourceUrls = [`${baseUrl}/blob.css`, `${baseUrl}/smurfs4.jpg`];

    checkWindow({cdt: [], resourceContents, tag: 'good1', url: `${baseUrl}/test.html`});
    expect((await close())[0].map(r => r.getAsExpected())).to.eql([true]);
  });

  it('handles "selector" sizeMode', async () => {
    const {checkWindow, close} = await openEyes({
      wrappers: [wrapper],
    });

    checkWindow({cdt: [], url: 'some url', selector: 'some selector'});
    expect((await close())[0].map(r => r.getAsExpected())).to.eql([true]);
  });

  it('handles "region" sizeMode', async () => {
    const {checkWindow, close} = await openEyes({
      wrappers: [wrapper],
    });

    checkWindow({cdt: [], url: 'some url', region: {width: 1, height: 2, left: 3, top: 4}});
    expect((await close())[0].map(r => r.getAsExpected())).to.eql([true]);
  });

  it('renders the correct browser', async () => {
    const {checkWindow, close} = await openEyes({
      wrappers: [wrapper],
      browser: {width: 320, height: 480, name: 'ucbrowser'},
      url: `${baseUrl}/test.html`,
    });

    const resourceUrls = wrapper.goodResourceUrls;
    const cdt = loadJsonFixture('test.cdt.json');
    checkWindow({
      resourceUrls,
      cdt,
      tag: 'good1',
      sizeMode: 'some size mode',
      url: `${baseUrl}/test.html`,
    });
    await close();
    expect(await wrapper.getInferredEnvironment()).to.equal('useragent:ucbrowser');
  });

  it('openEyes handles error during getRenderInfo', async () => {
    wrapper.getRenderInfo = async () => {
      await psetTimeout(0);
      throw new Error('getRenderInfo');
    };

    openEyes = makeRenderingGridClient({
      showLogs: process.env.APPLITOOLS_SHOW_LOGS,
      wrapper,
      apiKey,
    }).openEyes;

    await psetTimeout(50);

    const [error] = await presult(
      openEyes({
        wrappers: [wrapper],
      }),
    );
    expect(error.message).to.equal('getRenderInfo');
  });

  it('openEyes handles authorization error during getRenderInfo', async () => {
    wrapper.getRenderInfo = async () => {
      await psetTimeout(0);
      const err = new Error('');
      err.response = {status: 401};
      throw err;
    };

    openEyes = makeRenderingGridClient({
      showLogs: process.env.APPLITOOLS_SHOW_LOGS,
      wrapper,
      apiKey,
    }).openEyes;

    await psetTimeout(50);

    const [error] = await presult(
      openEyes({
        wrappers: [wrapper],
      }),
    );
    expect(error.message).to.equal(authorizationErrMsg);
  });

  it('handles error during rendering', async () => {
    wrapper.renderBatch = async () => {
      throw new Error('renderBatch');
    };
    openEyes = makeRenderingGridClient({
      showLogs: process.env.APPLITOOLS_SHOW_LOGS,
      wrapper,
      apiKey,
    }).openEyes;
    const {checkWindow, close} = await openEyes({
      wrappers: [wrapper],
      url: `bla`,
    });

    checkWindow({resourceUrls: [], cdt: [], url: `bla`});
    await psetTimeout(0);
    checkWindow({resourceUrls: [], cdt: [], url: `bla`});
    const error = await close().then(x => x, err => err);
    expect(error.message).to.equal('renderBatch');
  });

  it('handles error during checkWindow', async () => {
    wrapper.checkWindow = async () => {
      throw new Error('checkWindow');
    };
    openEyes = makeRenderingGridClient({
      showLogs: process.env.APPLITOOLS_SHOW_LOGS,
      wrapper,
      apiKey,
    }).openEyes;
    const {checkWindow, close} = await openEyes({
      wrappers: [wrapper],
    });

    checkWindow({resourceUrls: [], cdt: [], url: `bla`});
    await psetTimeout(0);
    checkWindow({resourceUrls: [], cdt: [], url: `bla`});
    const error = await close().then(x => x, err => err);
    expect(error.message).to.equal('checkWindow');
  });

  it('throws error during close', async () => {
    let error;
    wrapper.close = async () => {
      await psetTimeout(0);
      throw new Error('close');
    };
    const {close} = await openEyes({
      wrappers: [wrapper],
    });

    error = await close().then(x => x, err => err);
    expect(error.message).to.equal('close');
  });

  it('runs open/close with max concurrency', async () => {
    const wrapper1 = createFakeWrapper(baseUrl);
    const wrapper2 = createFakeWrapper(baseUrl);
    const wrapper3 = createFakeWrapper(baseUrl);

    let flag;
    wrapper3.open = async () => {
      flag = true;
    };

    openEyes = makeRenderingGridClient({
      concurrency: 2,
      showLogs: process.env.APPLITOOLS_SHOW_LOGS,
      wrapper,
      apiKey,
    }).openEyes;

    const {close} = await openEyes({wrappers: [wrapper1]});
    await openEyes({wrappers: [wrapper2]});
    openEyes({wrappers: [wrapper3]});
    expect(flag).to.equal(undefined);
    await close();
    expect(flag).to.equal(true);
  });

  it('ends throat job when close throws', async () => {
    wrapper.close = async () => {
      await psetTimeout(0);
      throw new Error('close');
    };

    openEyes = makeRenderingGridClient({
      concurrency: 1,
      showLogs: process.env.APPLITOOLS_SHOW_LOGS,
      wrapper,
      apiKey,
    }).openEyes;

    const {close} = await openEyes({wrappers: [wrapper]});
    const err1 = await close().then(x => x, err => err);
    expect(err1.message).to.equal('close');
    const {close: close2} = await Promise.race([
      openEyes({wrappers: [wrapper]}),
      psetTimeout(100).then(() => ({close: 'not resolved'})),
    ]);
    expect(close2).not.to.equal('not resolved');
    const err2 = await close2().then(x => x, err => err);
    expect(err2.message).to.equal('close');
  });

  describe.only('max concurrency for render', () => {
    let counter;
    let finishRenders;
    beforeEach(() => {
      counter = 0;
      finishRenders = [];
      wrapper.getRenderStatus = renderIds =>
        new Promise(resolve => {
          counter += renderIds.length;
          finishRenders.push(() =>
            resolve(
              renderIds.map(() =>
                RenderStatusResults.fromObject({
                  status: RenderStatus.RENDERED,
                  imageLocation: JSON.stringify({isGood: true, counter}),
                }),
              ),
            ),
          );
        });
    });

    beforeEach(() => {
      openEyes = makeRenderingGridClient({
        concurrency: 2,
        renderConcurrencyFactor: 1,
        renderStatusInterval: 50,
        showLogs: process.env.APPLITOOLS_SHOW_LOGS,
        wrapper,
        apiKey,
      }).openEyes;
    });

    it.only('runs renders with max concurrency', async () => {
      const {checkWindow, close} = await openEyes({wrappers: [wrapper]});
      checkWindow({url: '', cdt: [], sizeMode: null});
      await psetTimeout(0);
      checkWindow({url: '', cdt: [], sizeMode: null});
      await psetTimeout(0);
      checkWindow({url: '', cdt: [], sizeMode: null});
      await psetTimeout(1000);
      console.log('after');
      const expected1 = counter;
      finishRenders[0]();
      await psetTimeout(100);
      const expected2 = counter;
      finishRenders[1]();
      await close();
      expect(expected1).to.equal(2);
      expect(expected2).to.equal(3);
      expect(counter).to.equal(3);
    });

    it('runs renders with max concurrency for multiple browsers', async () => {
      const {checkWindow, close} = await openEyes({
        wrappers: [wrapper, wrapper],
        browser: [{width: 1, height: 1}, {width: 2, height: 2}],
      });

      checkWindow({url: '', cdt: [], sizeMode: null});
      await psetTimeout(0);
      checkWindow({url: '', cdt: [], sizeMode: null});
      await psetTimeout(0);
      const expected1 = counter;
      finishRenders[0]();
      await psetTimeout(0);
      const expected2 = counter;
      finishRenders[1]();
      finishRenders[2]();
      finishRenders[3]();
      await close();
      expect(expected1).to.equal(2);
      expect(expected2).to.equal(4);
      expect(counter).to.equal(4);
    });

    it('runs renders with max concurrency between open/close', async () => {
      const {checkWindow, close} = await openEyes({
        wrappers: [wrapper],
      });

      const {checkWindow: checkWindow2, close: close2} = await openEyes({
        wrappers: [wrapper],
      });

      checkWindow({url: '', cdt: [], sizeMode: null});
      await psetTimeout(0);

      checkWindow2({url: '', cdt: [], sizeMode: null});
      await psetTimeout(0);

      checkWindow({url: '', cdt: [], sizeMode: null});
      await psetTimeout(0);

      checkWindow2({url: '', cdt: [], sizeMode: null});
      await psetTimeout(0);

      const expected1 = counter;
      finishRenders[0]();
      await psetTimeout(0);

      const expected2 = counter;
      finishRenders[1]();
      finishRenders[2]();
      finishRenders[3]();

      await close();
      await close2();
      expect(expected1).to.equal(2);
      expect(expected2).to.equal(4);
      expect(counter).to.equal(4);
    });
  });

  it('handles render status timeout when second checkWindow starts AFTER timeout of previous checkWindow', async () => {
    wrapper.getRenderStatus = async () => {
      await psetTimeout(0);
      const rs = new RenderStatusResults();
      rs.setStatus(RenderStatus.RENDERING);
      return [rs];
    };

    openEyes = makeRenderingGridClient({
      showLogs: process.env.APPLITOOLS_SHOW_LOGS,
      renderStatusTimeout: 50,
      renderStatusInterval: 50,
      wrapper,
      apiKey,
    }).openEyes;

    const {checkWindow, close} = await openEyes({
      wrappers: [wrapper],
    });

    checkWindow({resourceUrls: [], cdt: [], url: 'bla', tag: 'good1'});
    await psetTimeout(150);
    checkWindow({resourceUrls: [], cdt: [], url: 'bla', tag: 'good1'});

    const [err3] = await presult(close());
    expect(err3.message).to.equal('failed to render screenshot');
  });

  it('handles render status timeout when second checkWindow starts BEFORE timeout of previous checkWindow', async () => {
    wrapper.getRenderStatus = async () => {
      await psetTimeout(0);
      const rs = new RenderStatusResults();
      rs.setStatus(RenderStatus.RENDERING);
      return [rs];
    };

    openEyes = makeRenderingGridClient({
      showLogs: process.env.APPLITOOLS_SHOW_LOGS,
      renderStatusTimeout: 150,
      renderStatusInterval: 50,
      wrapper,
      apiKey,
    }).openEyes;

    const {checkWindow, close} = await openEyes({
      wrappers: [wrapper],
    });

    checkWindow({resourceUrls: [], cdt: [], url: 'bla', tag: 'good1'});
    await psetTimeout(0);
    checkWindow({resourceUrls: [], cdt: [], url: 'bla', tag: 'good1'});
    await psetTimeout(200);
    const [err3] = await presult(close());
    expect(err3.message).to.equal('failed to render screenshot');
  });

  it('sets configuration on wrappers', () => {
    openEyes({
      wrappers: [wrapper],
      url: 'bla',
      baselineBranchName: 'baselineBranchName',
      baselineEnvName: 'baselineEnvName',
      baselineName: 'baselineName',
      envName: 'envName',
      ignoreCaret: 'ignoreCaret',
      isDisabled: false,
      matchLevel: 'matchLevel',
      matchTimeout: 'matchTimeout',
      parentBranchName: 'parentBranchName',
      branchName: 'branchName',
      proxy: 'proxy',
      saveFailedTests: 'saveFailedTests',
      saveNewTests: 'saveNewTests',
      compareWithParentBranch: 'compareWithParentBranch',
      ignoreBaseline: 'ignoreBaseline',
    });

    expect(wrapper.baselineBranchName).to.equal('baselineBranchName');
    expect(wrapper.baselineEnvName).to.equal('baselineEnvName');
    expect(wrapper.baselineName).to.equal('baselineName');
    expect(wrapper.envName).to.equal('envName');
    expect(wrapper.ignoreCaret).to.equal('ignoreCaret');
    expect(wrapper.isDisabled).to.equal(false);
    expect(wrapper.matchLevel).to.equal('matchLevel');
    expect(wrapper.matchTimeout).to.equal('matchTimeout');
    expect(wrapper.parentBranchName).to.equal('parentBranchName');
    expect(wrapper.branchName).to.equal('branchName');
    expect(wrapper.proxy).to.equal('proxy');
    expect(wrapper.saveFailedTests).to.equal('saveFailedTests');
    expect(wrapper.saveNewTests).to.equal('saveNewTests');
    expect(wrapper.compareWithParentBranch).to.equal('compareWithParentBranch');
    expect(wrapper.ignoreBaseline).to.equal('ignoreBaseline');
    expect(wrapper.serverUrl).to.equal('serverUrl');
  });

  it("doesn't do anything when isDisabled", async () => {
    const {checkWindow, close, abort} = await openEyes({
      isDisabled: true,
      wrappers: [{_logger: console}],
    });

    checkWindow({});
    expect(await close()).to.equal(undefined);
    expect(await abort()).to.equal(undefined);
  });

  it('throws missing apiKey msg', async () => {
    const err = await openEyes({}).then(x => x, err => err);
    expect(err.message).to.equal(apiKeyFailMsg);
  });

  it("doesn't init wrapper when isDisabled", async () => {
    const result = await openEyes({isDisabled: true}).then(x => x, err => err);
    expect(result).not.to.be.instanceof(Error);
  });

  it('handles ignore regions', async () => {
    const {checkWindow, close} = await openEyes({
      wrappers: [wrapper],
    });
    const region = {left: 1, top: 2, width: 3, height: 4};
    checkWindow({
      url: '',
      // resourceUrls: [],
      cdt: [],
      ignore: [region],
    });
    const [results] = await close();
    expect(results[0].getAsExpected()).to.equal(true);
    expect(results[0].__checkSettings.getIgnoreRegions()).to.eql([
      new IgnoreRegionByRectangle(Region.fromObject(region)),
    ]);
  });

  it('handles ignore regions with selector', async () => {
    const {checkWindow, close} = await openEyes({
      wrappers: [wrapper],
    });

    const ignoreSelector1 = {selector: 'sel1'};
    const region1FromStatusResults = FakeEyesWrapper.selectorsToLocations['sel1'];
    const region1 = Region.fromObject({
      left: region1FromStatusResults.x,
      top: region1FromStatusResults.y,
      width: region1FromStatusResults.width,
      height: region1FromStatusResults.height,
    });

    const ignoreSelector2 = {selector: 'sel2'};
    const region2FromStatusResults = FakeEyesWrapper.selectorsToLocations['sel2'];
    const region2 = Region.fromObject({
      left: region2FromStatusResults.x,
      top: region2FromStatusResults.y,
      width: region2FromStatusResults.width,
      height: region2FromStatusResults.height,
    });

    checkWindow({
      url: '',
      // resourceUrls: [],
      cdt: [],
      ignore: [ignoreSelector1, ignoreSelector2],
    });
    const [results] = await close();
    expect(results[0].getAsExpected()).to.equal(true);
    expect(results[0].__checkSettings.getIgnoreRegions()).to.eql([
      new IgnoreRegionByRectangle(region1),
      new IgnoreRegionByRectangle(region2),
    ]);
  });

  it('handles ignore regions with selector, when sizeMode===selector', async () => {
    const {checkWindow, close} = await openEyes({
      wrappers: [wrapper],
    });
    const selector = 'sel1';
    const ignoreRegion = {left: 1, top: 2, width: 3, height: 4};
    const ignoreSelector = {selector: 'sel2'};
    const imageOffset = FakeEyesWrapper.selectorsToLocations[selector];
    const expectedSelectorRegion = FakeEyesWrapper.selectorsToLocations['sel2'];
    checkWindow({
      url: '',
      // resourceUrls: [],
      cdt: [],
      sizeMode: 'selector',
      selector,
      ignore: [ignoreRegion, ignoreSelector],
    });
    const [results] = await close();
    expect(results[0].getAsExpected()).to.equal(true);
    expect(results[0].__checkSettings.getIgnoreRegions()).to.eql([
      new IgnoreRegionByRectangle(Region.fromObject(ignoreRegion)),
      new IgnoreRegionByRectangle(
        Region.fromObject({
          left: expectedSelectorRegion.x - imageOffset.x,
          top: expectedSelectorRegion.y - imageOffset.y,
          width: expectedSelectorRegion.width,
          height: expectedSelectorRegion.height,
        }),
      ),
    ]);
  });

  it('handles ignore regions with selector and floating regions with selector, when sizeMode===selector', async () => {
    const {checkWindow, close} = await openEyes({
      wrappers: [wrapper],
    });
    const selector = 'sel1';
    const ignoreRegion = {left: 1, top: 2, width: 3, height: 4};
    const ignoreSelector = {selector: 'sel2'};
    const imageOffset = FakeEyesWrapper.selectorsToLocations[selector];
    const expectedSelectorRegion = FakeEyesWrapper.selectorsToLocations['sel2'];

    const floatingRegion = {
      left: 10,
      top: 11,
      width: 12,
      height: 13,
      maxUpOffset: 14,
      maxDownOffset: 15,
      maxLeftOffset: 16,
      maxRightOffset: 17,
    };

    const expectedFloatingRegion = FakeEyesWrapper.selectorsToLocations['sel3'];
    const floatingSelector = {
      selector: 'sel3',
      maxUpOffset: 18,
      maxDownOffset: 19,
      maxLeftOffset: 20,
      maxRightOffset: 21,
    };

    checkWindow({
      url: '',
      // resourceUrls: [],
      cdt: [],
      sizeMode: 'selector',
      selector,
      ignore: [ignoreRegion, ignoreSelector],
      floating: [floatingRegion, floatingSelector],
    });

    const [results] = await close();

    expect(results[0].getAsExpected()).to.equal(true);
    expect(results[0].__checkSettings.getIgnoreRegions()).to.eql([
      new IgnoreRegionByRectangle(Region.fromObject(ignoreRegion)),
      new IgnoreRegionByRectangle(
        Region.fromObject({
          left: expectedSelectorRegion.x - imageOffset.x,
          top: expectedSelectorRegion.y - imageOffset.y,
          width: expectedSelectorRegion.width,
          height: expectedSelectorRegion.height,
        }),
      ),
    ]);
    expect(results[0].__checkSettings.getFloatingRegions()).to.eql([
      new FloatingRegionByRectangle(
        Region.fromObject(floatingRegion),
        floatingRegion.maxUpOffset,
        floatingRegion.maxDownOffset,
        floatingRegion.maxLeftOffset,
        floatingRegion.maxRightOffset,
      ),
      new FloatingRegionByRectangle(
        Region.fromObject({
          left: expectedFloatingRegion.x - imageOffset.x,
          top: expectedFloatingRegion.y - imageOffset.y,
          width: expectedFloatingRegion.width,
          height: expectedFloatingRegion.height,
        }),
        floatingSelector.maxUpOffset,
        floatingSelector.maxDownOffset,
        floatingSelector.maxLeftOffset,
        floatingSelector.maxRightOffset,
      ),
    ]);
  });

  it('handles abort', async () => {
    const wrapper1 = createFakeWrapper(baseUrl);
    const wrapper2 = createFakeWrapper(baseUrl);
    const {abort} = await openEyes({
      wrappers: [wrapper1, wrapper2],
      browser: [{width: 1, height: 2}, {width: 3, height: 4}],
    });

    await abort();
    expect(wrapper1.aborted).to.equal(true);
    expect(wrapper2.aborted).to.equal(true);
  });

  it('renders deviceEmulation', async () => {
    const deviceName = 'iPhone 4';
    const {checkWindow, close} = await openEyes({
      wrappers: [wrapper],
      browser: {deviceName, screenOrientation: 'bla'},
    });

    checkWindow({url: '', cdt: []});
    const [[results]] = await close();
    expect(wrapper.viewportSize.toJSON()).to.eql(FakeEyesWrapper.devices['iPhone 4']);
    expect(results.getAsExpected()).to.equal(true);
  });

  it('sets renderInfo lazily', async () => {
    let flag = true;
    wrapper.getRenderInfo = async function() {
      await psetTimeout(50);
      return 'bla';
    };
    const wrapper2 = createFakeWrapper(baseUrl);
    wrapper2.getRenderInfo = async () => {
      flag = false;
      return 'kuku';
    };

    const p = openEyes({wrappers: [wrapper]});
    await psetTimeout(0);
    await openEyes({wrappers: [wrapper2]});
    expect(flag).to.equal(true);
    expect(wrapper2.renderingInfo).to.equal('bla');
    await p;
  });
});
