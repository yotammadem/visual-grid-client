'use strict';
const {describe, it, beforeEach} = require('mocha');
const {expect} = require('chai');
const mapValues = require('lodash.mapvalues');
const makeGetAllResources = require('../../../src/sdk/getAllResources');
const makeExtractCssResources = require('../../../src/sdk/extractCssResources');
const makeFetchResource = require('../../../src/sdk/fetchResource');
const createResourceCache = require('../../../src/sdk/createResourceCache');
const {RGridResource} = require('@applitools/eyes.sdk.core');
const testServer = require('../../util/testServer');
const testLogger = require('../../util/testLogger');
const {loadFixtureBuffer} = require('../../util/loadFixture');
const isCss = require('../../../src/sdk/isCss');

function toRGridResource({url, type, value}) {
  const resource = new RGridResource();
  resource.setUrl(url);
  resource.setContentType(type);
  resource.setContent(value);
  return resource;
}

describe('getAllResources', () => {
  let closeServer;
  let getAllResources, resourceCache;

  beforeEach(() => {
    const extractCssResources = makeExtractCssResources(testLogger);
    const fetchResource = makeFetchResource(testLogger);
    resourceCache = createResourceCache();
    getAllResources = makeGetAllResources({
      resourceCache,
      extractCssResources,
      fetchResource,
      fetchCache: createResourceCache(),
    });
  });

  it('works for absolute urls', async () => {
    const server = await testServer();
    const baseUrl = `http://localhost:${server.port}`;
    closeServer = server.close;

    const jpgName = 'smurfs.jpg';
    const jpgName1 = 'smurfs1.jpg';
    const jpgName2 = 'smurfs2.jpg';
    const jpgName3 = 'smurfs3.jpg';
    const cssName = 'test.css';
    const jsonName = 'test.cdt.json';
    const jsName = 'test.js';
    const importedName = 'imported.css';
    const importedNestedName = 'imported-nested.css';
    const fontZillaName = 'zilla_slab.woff2';
    const fontShadowName = 'shadows_into_light.woff2';
    const jpgUrl = `${baseUrl}/${jpgName}`;
    const jpgUrl1 = `${baseUrl}/${jpgName1}`;
    const jpgUrl2 = `${baseUrl}/${jpgName2}`;
    const jpgUrl3 = `${baseUrl}/${jpgName3}`;
    const cssUrl = `${baseUrl}/${cssName}`;
    const jsonUrl = `${baseUrl}/${jsonName}`;
    const jsUrl = `${baseUrl}/${jsName}`;
    const importedUrl = `${baseUrl}/${importedName}`;
    const importedNestedUrl = `${baseUrl}/${importedNestedName}`;
    const fontZillaUrl = `${baseUrl}/${fontZillaName}`;
    const fontShadowUrl = `${baseUrl}/${fontShadowName}`;
    const jpgContent = loadFixtureBuffer(jpgName);
    const jpgContent1 = loadFixtureBuffer(jpgName1);
    const jpgContent2 = loadFixtureBuffer(jpgName2);
    const jpgContent3 = loadFixtureBuffer(jpgName3);
    const cssContent = loadFixtureBuffer(cssName);
    const jsonContent = loadFixtureBuffer(jsonName);
    const jsContent = loadFixtureBuffer(jsName);
    const importedContent = loadFixtureBuffer(importedName);
    const importedNestedContent = loadFixtureBuffer(importedNestedName);
    const fontZillaContent = loadFixtureBuffer(fontZillaName);
    const fontShadowContent = loadFixtureBuffer(fontShadowName);

    const expected = mapValues(
      {
        [jpgUrl]: {type: 'image/jpeg', value: jpgContent},
        [jpgUrl1]: {type: 'image/jpeg', value: jpgContent1},
        [jpgUrl2]: {type: 'image/jpeg', value: jpgContent2},
        [jpgUrl3]: {type: 'image/jpeg', value: jpgContent3},
        [cssUrl]: {type: 'text/css; charset=UTF-8', value: cssContent},
        [jsonUrl]: {type: 'application/json; charset=UTF-8', value: jsonContent},
        [jsUrl]: {type: 'application/javascript; charset=UTF-8', value: jsContent},
        [importedUrl]: {type: 'text/css; charset=UTF-8', value: importedContent},
        [importedNestedUrl]: {
          type: 'text/css; charset=UTF-8',
          value: importedNestedContent,
        },
        [fontZillaUrl]: {type: 'application/font-woff2', value: fontZillaContent},
        [fontShadowUrl]: {type: 'application/font-woff2', value: fontShadowContent},
      },
      (o, url) => toRGridResource({type: o.type, value: o.value, url}),
    );

    try {
      const resources = await getAllResources([jpgUrl, cssUrl, jsonUrl, jsUrl]);
      expect(resources).to.deep.equal(expected);
    } catch (ex) {
      throw ex;
    } finally {
      await closeServer();
    }
  });

  it('fetches with cache', async () => {
    const url = 'url';
    const type = 'type';
    const value = 'value';
    const rGridResource = toRGridResource({url, type, value});
    rGridResource._content = undefined; // yuck! but this is the symmetrical yuck of getAllResources::fromCacheToRGridResource since we save resource in cache without content, but with SHA256

    resourceCache.setValue(url, {url, type, hash: undefined});

    const expected = {
      [url]: rGridResource,
    };

    const resourcesFromCache = await getAllResources([url]);
    expect(resourcesFromCache).to.deep.equal(expected);
  });

  it('works for urls with long paths', async () => {
    const server = await testServer();
    closeServer = server.close;

    const url = `long/path/to/something.js`;
    const absoluteUrl = `http://localhost:${server.port}/${url}`;
    const expected = {
      [absoluteUrl]: toRGridResource({
        url: absoluteUrl,
        type: 'application/javascript; charset=UTF-8',
        value: loadFixtureBuffer(url),
      }),
    };

    try {
      const resources = await getAllResources([absoluteUrl]);
      expect(resources).to.deep.equal(expected);
    } catch (ex) {
      throw ex;
    } finally {
      await closeServer();
    }
  });

  it('gets inner css resources also for cached resources', async () => {
    const baseUrl = `http://some/`;

    const jpgName1 = 'smurfs1.jpg';
    const jpgName2 = 'smurfs2.jpg';
    const jpgName3 = 'smurfs3.jpg';
    const cssName = 'test.css';
    const importedName = 'imported.css';
    const importedNestedName = 'imported-nested.css';
    const fontZillaName = 'zilla_slab.woff2';
    const fontShadowName = 'shadows_into_light.woff2';
    const jpgUrl1 = `${baseUrl}/${jpgName1}`;
    const jpgUrl2 = `${baseUrl}/${jpgName2}`;
    const jpgUrl3 = `${baseUrl}/${jpgName3}`;
    const cssUrl = `${baseUrl}/${cssName}`;
    const importedUrl = `${baseUrl}/${importedName}`;
    const importedNestedUrl = `${baseUrl}/${importedNestedName}`;
    const fontZillaUrl = `${baseUrl}/${fontZillaName}`;
    const fontShadowUrl = `${baseUrl}/${fontShadowName}`;
    const jpgContent1 = loadFixtureBuffer(jpgName1);
    const jpgContent2 = loadFixtureBuffer(jpgName2);
    const jpgContent3 = loadFixtureBuffer(jpgName3);
    const cssContent = loadFixtureBuffer(cssName);
    const importedContent = loadFixtureBuffer(importedName);
    const importedNestedContent = loadFixtureBuffer(importedNestedName);
    const fontZillaContent = loadFixtureBuffer(fontZillaName);
    const fontShadowContent = loadFixtureBuffer(fontShadowName);
    const jpgType = 'image/jpeg';
    const cssType = 'text/css; charset=UTF-8';
    const fontType = 'application/font-woff2';

    resourceCache.setValue(jpgUrl1, {url: jpgUrl1, type: jpgType, hash: undefined});
    resourceCache.setValue(jpgUrl2, {url: jpgUrl2, type: jpgType, hash: undefined});
    resourceCache.setValue(jpgUrl3, {url: jpgUrl3, type: jpgType, hash: undefined});
    resourceCache.setValue(cssUrl, {
      url: cssUrl,
      type: cssType,
      hash: undefined,
      content: loadFixtureBuffer('test.css'),
    });
    resourceCache.setValue(importedUrl, {
      url: importedUrl,
      type: cssType,
      hash: undefined,
      content: loadFixtureBuffer('imported.css'),
    });
    resourceCache.setValue(importedNestedUrl, {
      url: importedNestedUrl,
      type: cssType,
      hash: undefined,
      content: loadFixtureBuffer('imported-nested.css'),
    });
    resourceCache.setValue(fontZillaUrl, {url: fontZillaUrl, type: fontType, hash: undefined});
    resourceCache.setValue(fontShadowUrl, {url: fontShadowUrl, type: fontType, hash: undefined});

    resourceCache.setDependencies(cssUrl, [importedUrl, fontZillaUrl]);
    resourceCache.setDependencies(importedUrl, [
      importedNestedUrl,
      fontShadowUrl,
      jpgUrl1,
      jpgUrl2,
      jpgUrl3,
    ]);

    const expected = mapValues(
      {
        [cssUrl]: {type: cssType, value: cssContent},
        [importedUrl]: {type: cssType, value: importedContent},
        [fontZillaUrl]: {type: fontType, value: fontZillaContent},
        [importedNestedUrl]: {
          type: cssType,
          value: importedNestedContent,
        },
        [fontShadowUrl]: {type: fontType, value: fontShadowContent},
        [jpgUrl3]: {type: jpgType, value: jpgContent3},
        [jpgUrl1]: {type: jpgType, value: jpgContent1},
        [jpgUrl2]: {type: jpgType, value: jpgContent2},
      },
      (o, url) => {
        const rGridResource = toRGridResource({type: o.type, value: o.value, url});
        if (!isCss(rGridResource.getContentType())) rGridResource._content = undefined; // yuck! but this is the symmetrical yuck of getAllResources::fromCacheToRGridResource since we save resource in cache without content, but with SHA256
        return rGridResource;
      },
    );

    const resourcesFromCache = await getAllResources([cssUrl]);
    expect(resourcesFromCache).to.deep.equal(expected);
  });

  it("doesn't crash with unsupported protocols", async () => {
    const resources = await getAllResources([
      'data:text/html,<div>',
      'blob:http://localhost/something.css',
    ]).then(x => x, err => err);
    expect(resources).to.eql({});
  });

  it('handles uppercase urls', async () => {
    const server = await testServer();
    closeServer = server.close;
    try {
      const url = `HTTP://LOCALHOST:${server.port}/imported2.css`;
      const resources = await getAllResources([url]).then(x => x, err => err);
      expect(resources).to.eql({
        [url]: toRGridResource({
          url,
          type: 'text/css; charset=UTF-8',
          value: loadFixtureBuffer('imported2.css'),
        }),
      });
    } catch (ex) {
      throw ex;
    } finally {
      await closeServer();
    }
  });

  it('handles frames as resources', async () => {
    const server = await testServer();
    closeServer = server.close;

    const baseUrl = `http://localhost:${server.port}`;
    const iframeUrl = 'http://url/to/iframe.html';
    const iframeContent = new RGridDom();
    const cdt = iframeContent._getContentAsCdt();

    const preResources = {
      [iframeUrl]: {url: iframeUrl, type: 'application/x-applitools-cdt', content: cdt},
    };

    const resources = await getAllResources([], preResources);
  });

  it('gets resources from prefilled resources', async () => {
    const server = await testServer();
    closeServer = server.close;

    const baseUrl = `http://localhost:${server.port}`;

    const cssName = 'blob.css';
    const cssValue = loadFixtureBuffer(cssName);
    const cssUrl = `${baseUrl}/${cssName}`;
    const cssType = 'text/css; charset=UTF-8';

    const imgName = 'smurfs4.jpg';
    const imgUrl = `${baseUrl}/${imgName}`;
    const imgValue = loadFixtureBuffer(imgName);
    const imgType = 'image/jpeg';

    const fontZillaName = 'zilla_slab.woff2';
    const fontZillaUrl = `${baseUrl}/${fontZillaName}`;
    const fontZillaValue = loadFixtureBuffer(fontZillaName);
    const fontZillaType = 'application/font-woff2';

    const preResources = {
      [cssUrl]: {url: cssUrl, type: cssType, value: cssValue},
    };

    try {
      const resources = await getAllResources([fontZillaUrl], preResources);

      const expected = mapValues(
        {
          [cssUrl]: {type: cssType, value: cssValue},
          [imgUrl]: {type: imgType, value: imgValue},
          [fontZillaUrl]: {type: fontZillaType, value: fontZillaValue},
        },
        ({type, value}, url) => toRGridResource({type, value, url}),
      );

      expect(resources).to.eql(expected);
    } catch (ex) {
      throw ex;
    } finally {
      await closeServer();
    }
  });

  // TODO enable this
  it.skip('works for unknown content-type', async () => {
    const server = await testServer();
    closeServer = server.close;

    const url = 'no-content-type';
    const absoluteUrl = `http://localhost:${server.port}/${url}`;
    const expected = {
      [absoluteUrl]: toRGridResource({
        url: absoluteUrl,
        type: 'application/x-applitools-unknown',
        value: loadFixtureBuffer(url),
      }),
    };

    try {
      const resources = await getAllResources([absoluteUrl]);
      expect(resources).to.deep.equal(expected);
    } catch (ex) {
      throw ex;
    } finally {
      await closeServer();
    }

    const expectedFromCache = mapValues(expected, rGridResource => {
      rGridResource._content = null; // yuck! but this is the symmetrical yuck of getAllResources::fromCacheToRGridResource since we save resource in cache without content, but with SHA256
      return rGridResource;
    });

    const resourcesFromCache = await getAllResources([absoluteUrl]);
    expect(resourcesFromCache).to.deep.equal(expectedFromCache);
  });

  it('uses cache for all resources that were passed as preResources', async () => {
    const baseUrl = 'http://fake';
    const cssName = 'blob.css';
    const imgName = 'smurfs4.jpg';
    const cssUrl = `${baseUrl}/${cssName}`;
    const imgUrl = `${baseUrl}/${imgName}`;
    const cssBuffer = loadFixtureBuffer(cssName);
    const imgBuffer = loadFixtureBuffer(imgName);

    const resources = await getAllResources([], {
      [cssUrl]: {
        url: cssUrl,
        type: 'text/css',
        value: cssBuffer,
      },
      [imgUrl]: {
        url: imgUrl,
        type: 'bla jpeg',
        value: imgBuffer,
      },
    });

    expect(resources).to.eql({
      [cssUrl]: toRGridResource({
        url: cssUrl,
        type: 'text/css',
        value: cssBuffer,
      }),
      [imgUrl]: toRGridResource({
        url: imgUrl,
        type: 'bla jpeg',
        value: imgBuffer,
      }),
    });
  });
});
