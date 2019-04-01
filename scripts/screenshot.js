'use strict';

const puppeteer = require('puppeteer');
const takeScreenshot = require('../src/sdk/takeScreenshot');
const {getProcessPageAndSerializeScript} = require('@applitools/dom-snapshot');
const debug = require('debug')('render');

(async function() {
  const website = process.argv[2];

  if (!website) {
    console.log('no website passed');
    return;
  }

  const apiKey = process.env.APPLITOOLS_API_KEY;
  const serverUrl = process.env.APPLITOOLS_SERVER_URL || 'https://eyesapi.applitools.com';
  const renderInfo = await fetch(`${serverUrl}/api/sessions/renderInfo?apiKey=${apiKey}`).then(r =>
    r.json(),
  );

  debug('renderInfo', renderInfo);

  console.log('checking website:', website);

  debug('open done');

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const processPageAndSerialize = `(${await getProcessPageAndSerializeScript()})()`;

  await page.goto(website);

  debug('navigation done');

  const {cdt, url, resourceUrls, blobs, frames} = await page.evaluate(processPageAndSerialize);

  debug('processPage done');

  const imageLocations = await takeScreenshot({
    apiKey,
    showLogs: process.env.APPLITOOLS_SHOW_LOGS,
    proxy: process.env.APPLITOOLS_PROXY,
    serverUrl,
    renderInfo,
    cdt,
    url,
    resourceUrls,
    blobs,
    frames,
    browsers: [{width: 1024, height: 768}, {width: 320, height: 480}],
  }).catch(err => err);
  if (imageLocations instanceof Error) {
    console.log('error!', imageLocations);
  } else {
    console.log('images:', imageLocations);
  }
  await browser.close();
  debug('browser closed');
})();
