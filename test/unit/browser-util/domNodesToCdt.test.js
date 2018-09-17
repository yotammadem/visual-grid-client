'use strict';
const {describe, it} = require('mocha');
const {expect} = require('chai');
const {JSDOM} = require('jsdom');
const domNodesToCdt = require('../../../src/browser-util/domNodesToCdt');
const {NODE_TYPES} = domNodesToCdt;
const {loadFixture, loadJsonFixture} = require('../../util/loadFixture');
const _fs = require('fs');
const {resolve: _r} = require('path');

function getDocNode(htmlStr) {
  const dom = new JSDOM(htmlStr, {url: 'http://something.org/'});
  return dom.window.document;
}

describe('domNodesToCdt', () => {
  it('works for DOM with 1 element', () => {
    const docNode = getDocNode('<div style="color:red;">hello</div>');
    const cdt = domNodesToCdt(docNode);
    const expected = [
      {
        nodeType: NODE_TYPES.DOCUMENT,
        childNodeIndexes: [5],
      },
      {
        nodeType: NODE_TYPES.ELEMENT,
        nodeName: 'HEAD',
        attributes: [],
        childNodeIndexes: [],
      },
      {
        nodeType: NODE_TYPES.TEXT,
        nodeValue: 'hello',
      },
      {
        nodeType: NODE_TYPES.ELEMENT,
        nodeName: 'DIV',
        childNodeIndexes: [2],
        attributes: [{name: 'style', value: 'color:red;'}],
      },
      {
        nodeType: NODE_TYPES.ELEMENT,
        nodeName: 'BODY',
        childNodeIndexes: [3],
        attributes: [],
      },
      {
        nodeType: NODE_TYPES.ELEMENT,
        nodeName: 'HTML',
        attributes: [],
        childNodeIndexes: [1, 4],
      },
    ];
    expect(cdt).to.deep.equal(expected);
  });

  it('works for test.html', () => {
    const docNode = getDocNode(loadFixture('test.html'));
    const cdt = domNodesToCdt(docNode);
    // _fs.writeFileSync(_r(__dirname, '../../fixtures/test.orig.cdt.json'), JSON.stringify(cdt, null, 2));
    const expectedCdt = loadJsonFixture('test.orig.cdt.json');
    expect(cdt).to.deep.equal(expectedCdt);
  });

  it.only('works for testIframe.html', () => {
    const docNode = getDocNode(loadFixture('testIframe.html'));
    const cdt = domNodesToCdt(docNode);
    const iframeDocNode = getDocNode(loadFixture('iframe.html'));
    const iframeCdt = domNodesToCdt(iframeDocNode);
    _fs.writeFileSync(
      _r(__dirname, '../../fixtures/testIframe.cdt.json'),
      JSON.stringify(cdt, null, 2),
    );
    _fs.writeFileSync(
      _r(__dirname, '../../fixtures/iframe.cdt.json'),
      JSON.stringify(iframeCdt, null, 2),
    );
    const expectedCdt = loadJsonFixture('testIframe.cdt.json');
    const expectedCdt2 = loadJsonFixture('iframe.cdt.json');
    expect(cdt).to.deep.equal(expectedCdt);
    expect(iframeCdt).to.deep.equal(expectedCdt2);
  });
});
