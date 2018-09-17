'use strict';

const {describe, it, before, after, beforeEach} = require('mocha');
const {expect} = require('chai');
const makeRenderingGridClient = require('../../src/sdk/renderingGridClient');
const testServer = require('../util/testServer');
const {DiffsFoundError} = require('@applitools/eyes.sdk.core');
const {loadJsonFixture, loadFixtureBuffer} = require('../util/loadFixture');
const {initConfig} = require('../../src/sdk/config');

describe('openEyes', () => {
  let baseUrl, closeServer, openEyes;
  const apiKey = process.env.APPLITOOLS_API_KEY; // TODO bad for tests. what to do

  beforeEach(() => {
    openEyes = makeRenderingGridClient(
      Object.assign({showLogs: process.env.APPLITOOLS_SHOW_LOGS}, initConfig()),
    ).openEyes;
  });

  before(async () => {
    if (!apiKey) {
      throw new Error('APPLITOOLS_API_KEY env variable is not defined');
    }
    const server = await testServer({port: 3456}); // TODO fixed port avoids 'need-more-resources' for dom. Is this desired? should both paths be tested?
    baseUrl = `http://localhost:${server.port}`;
    closeServer = server.close;
  });

  after(async () => {
    await closeServer();
  });

  it('passes with correct screenshot', async () => {
    const {checkWindow, close} = await openEyes({
      appName: 'some app',
      testName: 'passes with correct screenshot',
      apiKey,
      browser: [
        {width: 640, height: 480, name: 'chrome'},
        {width: 800, height: 600, name: 'firefox'},
      ],
      showLogs: process.env.APPLITOOLS_SHOW_LOGS,
      saveDebugData: process.env.APPLITOOLS_SAVE_DEBUG_DATA,
    });

    const resourceUrls = ['smurfs.jpg', 'test.css'];
    const cdt = loadJsonFixture('test.cdt.json');
    const resourceContents = {
      [`a-made-up-blob-url-1`]: {
        url: `a-made-up-blob-url-1`,
        type: 'text/css',
        value: loadFixtureBuffer('blob.css'),
      },
      [`a-made-up-blob-url-2`]: {
        url: `a-made-up-blob-url-2`,
        type: 'image/jpeg',
        value: loadFixtureBuffer('smurfs4.jpg'),
      },
    };
    const scriptHooks = {
      beforeCaptureScreenshot: "document.body.style.backgroundColor = 'gold'",
    };

    await checkWindow({
      resourceUrls,
      resourceContents,
      cdt,
      tag: 'first',
      url: `${baseUrl}/test.html`,
      scriptHooks,
    });
    await close();
  });

  it.only('passes with correct screenshot (iframe)', async () => {
    const {checkWindow, close} = await openEyes({
      appName: 'some app',
      testName: 'passes with correct screenshot',
      apiKey,
      browser: [
        {width: 640, height: 480, name: 'chrome'},
        {width: 800, height: 600, name: 'firefox'},
      ],
      showLogs: process.env.APPLITOOLS_SHOW_LOGS,
      saveDebugData: process.env.APPLITOOLS_SAVE_DEBUG_DATA,
    });

    const frameUrl = `${baseUrl}/iframe.html`;
    const jpgUrl = `${baseUrl}/smurfs.jpg`;
    const resourceUrls = ['imported2.css'];
    const cdt = loadJsonFixture('testIframe.cdt.json');
    const domNodes = loadJsonFixture('iframe.cdt.json');
    const resourceContents = {
      [frameUrl]: {
        url: frameUrl,
        type: 'x-applitools-html/cdt',
      },
    };

    const frames = {
      [frameUrl]: {
        cdt: domNodes,
        resourceUrls: [],
        resourceContents: {
          [jpgUrl]: {
            url: jpgUrl,
            type: 'image/jpg',
            content: loadFixtureBuffer('smurfs.jpg'),
          },
        },
      },
    };

    await checkWindow({
      resourceUrls,
      resourceContents,
      cdt,
      frames,
      tag: 'first',
      url: `${baseUrl}/testIframe.html`,
    });
    await close();
  });

  it('fails with incorrect screenshot', async () => {
    const {checkWindow, close} = await openEyes({
      appName: 'some app',
      testName: 'fails with incorrect screenshot',
      apiKey,
      browser: [{width: 640, height: 480}, {width: 800, height: 600}],
      showLogs: process.env.APPLITOOLS_SHOW_LOGS,
      saveDebugData: process.env.APPLITOOLS_SAVE_DEBUG_DATA,
    });

    const resourceUrls = ['smurfs.jpg', 'test.css'];
    const cdt = loadJsonFixture('test.cdt.json');
    cdt.find(node => node.nodeValue === "hi, I'm red").nodeValue = "hi, I'm green";
    const resourceContents = {
      [`a-made-up-blob-url-1`]: {
        url: `a-made-up-blob-url-1`,
        type: 'text/css',
        value: loadFixtureBuffer('blob.css'),
      },
      [`a-made-up-blob-url-2`]: {
        url: `a-made-up-blob-url-2`,
        type: 'image/jpeg',
        value: loadFixtureBuffer('smurfs4.jpg'),
      },
    };
    await checkWindow({
      resourceUrls,
      resourceContents,
      cdt,
      tag: 'first',
      url: `${baseUrl}/test.html`,
    });
    expect(await close().then(() => 'ok', err => err)).to.be.instanceOf(DiffsFoundError);
  });
});
