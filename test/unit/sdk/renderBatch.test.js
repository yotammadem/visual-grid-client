'use strict';
const {describe, it, beforeEach} = require('mocha');
const {expect} = require('chai');
const makeRenderBatch = require('../../../src/sdk/renderBatch');
const {RenderStatus} = require('@applitools/eyes.sdk.core');
const FakeRunningRender = require('../../util/FakeRunningRender');
const FakeRenderRequest = require('../../util/FakeRenderRequest');
const createResourceCache = require('../../../src/sdk/createResourceCache');
const testLogger = require('../../util/testLogger');

function getFuncs() {
  const resourcesPutted = [];
  return {
    async sendRenderBatch(renderRequests) {
      return renderRequests.map((renderRequest, i) => {
        const renderId = renderRequest.getRenderId();
        return new FakeRunningRender(
          renderId || `id${i + 1}`,
          renderId ? `status${i + 1}` : RenderStatus.NEED_MORE_RESOURCES,
        );
      });
    },
    async putResources(dom, runningRender) {
      resourcesPutted.push({dom, renderId: runningRender.getRenderId()});
    },
    resourcesPutted,
  };
}

describe('renderBatch', () => {
  let resourceCache, renderBatch, fetchCache, resourcesPutted, putResources;

  beforeEach(() => {
    const funcs = getFuncs();
    const {sendRenderBatch} = funcs;
    putResources = funcs.putResources;
    resourcesPutted = funcs.resourcesPutted;
    resourceCache = createResourceCache();
    fetchCache = createResourceCache();
    renderBatch = makeRenderBatch({
      putResources,
      resourceCache,
      fetchCache,
      logger: testLogger,
      sendRenderBatch,
    });
  });

  it('works', async () => {
    const renderRequests = [
      new FakeRenderRequest('dom1', []),
      new FakeRenderRequest('dom2', []),
      new FakeRenderRequest('dom3', [
        {
          getUrl() {
            return 'url-1';
          },
          getSha256Hash() {
            return 'sha256hash';
          },
          getContentType() {
            return 'contentType';
          },
          getContent() {
            return 'content';
          },
        },
        {
          getUrl() {
            return 'url-2';
          },
          getSha256Hash() {
            return 'sha256hash-2';
          },
          getContentType() {
            return 'text/css';
          },
          getContent() {
            return 'content-2';
          },
        },
      ]),
    ];

    const renderIds = await renderBatch(renderRequests);
    expect(renderIds).to.eql(['id1', 'id2', 'id3']);

    expect(renderRequests.map(renderRequest => renderRequest.getRenderId())).to.eql([
      'id1',
      'id2',
      'id3',
    ]);

    expect(resourcesPutted).to.eql([
      {dom: 'dom1', renderId: 'id1'},
      {dom: 'dom2', renderId: 'id2'},
      {dom: 'dom3', renderId: 'id3'},
    ]);

    expect(resourceCache.getValue('url-1')).to.eql({
      url: 'url-1',
      type: 'contentType',
      hash: 'sha256hash',
      content: undefined,
    });

    expect(resourceCache.getValue('url-2')).to.eql({
      url: 'url-2',
      type: 'text/css',
      hash: 'sha256hash-2',
      content: 'content-2',
    });
  });

  it('throws an error if need-more-resources is received on second render request', async () => {
    const renderBatch = makeRenderBatch({
      putResources,
      resourceCache,
      fetchCache,
      logger: testLogger,
      sendRenderBatch: async () => {
        // always returns need-more-resources
        return [new FakeRunningRender('some id', RenderStatus.NEED_MORE_RESOURCES)];
      },
    });
    const error = await renderBatch([new FakeRenderRequest('some dom')]).then(x => x, err => err);

    expect(error).to.be.an.instanceof(Error);
  });
});
