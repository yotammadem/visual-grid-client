/* global fetch */
'use strict';
require('isomorphic-fetch');
const {retryFetch} = require('@applitools/http-commons');
const createResourceCache = require('./createResourceCache');

function makeFetchResource({logger, retries = 5, fetchCache = createResourceCache()}) {
  return url => fetchCache.getValue(url) || fetchCache.setValue(url, doFetchResource(url));

  function doFetchResource(url) {
    return retryFetch(
      retry => {
        logger.log(`fetching ${url} ${retry ? `(retry ${retry}/${retries})` : ''}`);
        return fetch(url).then(resp =>
          resp.buffer().then(buff => ({
            url,
            type: resp.headers.get('Content-Type'),
            value: buff,
          })),
        );
      },
      {retries},
    ).then(result => {
      logger.log(`fetched ${url}`);
      return result;
    });
  }
}

module.exports = makeFetchResource;
