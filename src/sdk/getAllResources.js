'use strict';
const mapValues = require('lodash.mapvalues');
const {RGridResource, RGridDom} = require('@applitools/eyes.sdk.core');
const {URL} = require('url');
const isCss = require('./isCss');
const toCacheEntry = require('./toCacheEntry');

function fromCacheToRGridResource({url, type, hash, content}) {
  const resource = new RGridResource();
  resource.setUrl(url);
  resource.setContentType(type);
  content && resource.setContent(content);
  resource._sha256hash = hash; // yuck! but RGridResource assumes it always has the content, which we prefer not to save in cache.
  return resource;
}

function fromFetchedToRGridResource({url, type, value}) {
  const rGridResource = new RGridResource();
  rGridResource.setUrl(url);
  rGridResource.setContentType(type || 'application/x-applitools-unknown'); // TODO test this
  rGridResource.setContent(value);
  return rGridResource;
}

function makeProcessResource({
  resourceCache,
  getOrFetchResources,
  extractCssResources,
  fetchCache,
}) {
  return function processResource(resource) {
    const {url} = resource;
    return fetchCache.getValue(url) || fetchCache.setValue(url, doProcessResource(resource));
  };

  async function doProcessResource(resource) {
    let {dependentResources, fetchedResources} = await getDependantResources(resource);
    const rGridResource = fromFetchedToRGridResource(resource);
    resourceCache.setDependencies(resource.url, dependentResources);
    return Object.assign({[resource.url]: rGridResource}, fetchedResources);
  }

  async function getDependantResources({url, type, value}) {
    let dependentResources, fetchedResources;
    if (isCss(type)) {
      dependentResources = extractCssResources(value.toString(), url);
      fetchedResources = await getOrFetchResources(dependentResources);
    }
    return {dependentResources, fetchedResources};
  }
}

function makeGetAllResources({resourceCache, fetchResource, extractCssResources, fetchCache}) {
  const processResource = makeProcessResource({
    resourceCache,
    extractCssResources,
    getOrFetchResources,
    fetchCache,
  });

  return getOrFetchResources;

  async function getOrFetchResources(resourceUrls = [], preResources = {}, frames = {}) {
    const resources = {};

    for (const url in preResources) {
      const preResource = preResources[url];
      if (preResource.type === 'x-applitools-html/cdt') {
        const frame = frames[url];
        const rGridDom = new RGridDom();
        rGridDom.setDomNodes(frame.cdt);

        const frameResources = await getOrFetchResources(
          frame.resourceUrls,
          frame.resourceContents,
          frames,
        );

        rGridDom.setResources(frameResources);
        preResource.content = rGridDom._getContentAsCdt();
      }
    }

    for (const url in preResources) {
      resourceCache.setValue(url, toCacheEntry(fromFetchedToRGridResource(preResources[url])));
    }

    for (const url in preResources) {
      Object.assign(resources, await processResource(preResources[url]));
    }

    const missingResourceUrls = [];
    for (const url of resourceUrls) {
      const cacheEntry = resourceCache.getWithDependencies(url);
      if (cacheEntry) {
        Object.assign(resources, mapValues(cacheEntry, fromCacheToRGridResource));
      } else if (/^https?:$/i.test(new URL(url).protocol)) {
        missingResourceUrls.push(url);
      }
    }

    await Promise.all(
      missingResourceUrls.map(url =>
        fetchResource(url).then(async resource =>
          Object.assign(resources, await processResource(resource)),
        ),
      ),
    );

    return resources;
  }
}

module.exports = makeGetAllResources;
