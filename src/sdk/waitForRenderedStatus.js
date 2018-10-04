'use strict';
const {RenderStatus} = require('@applitools/eyes.sdk.core');
const {presult} = require('@applitools/functional-commons');

const psetTimeout = t =>
  new Promise(res => {
    setTimeout(res, t);
  });

function makeWaitForRenderedStatus({
  timeout = 120000,
  getStatusInterval = 500,
  sendGetRenderStatus,
  logger,
}) {
  let isRunning;
  const pendingRenders = {};

  return async function waitForRenderedStatus(renderId, stopCondition = () => {}) {
    return new Promise((resolve, reject) => {
      console.log('!!!', renderId);
      let pendingRender = pendingRenders[renderId];
      if (!pendingRender) {
        pendingRender = pendingRenders[renderId] = {resolve, reject, startTime: Date.now()};
      }
      if (!isRunning) {
        isRunning = true;
        getRenderStatusJob();
      }
    });

    async function getRenderStatusJob() {
      const renderIds = Object.keys(pendingRenders);
      console.log('render status job', renderIds);
      if (renderIds.length === 0 || stopCondition()) {
        isRunning = false;
        return;
      }

      const [err, renderStatuses] = await presult(sendGetRenderStatus(renderIds));

      if (err) {
        logger.log(`error during getRenderStatus: ${err}`);
        await psetTimeout(getStatusInterval);
        await getRenderStatusJob();
        return;
      }

      renderStatuses.forEach((rs, i) => {
        const status = rs.getStatus();
        const renderId = renderIds[i];
        const pendingRender = pendingRenders[renderId];
        if (status === RenderStatus.ERROR) {
          delete pendingRenders[renderId];
          pendingRender.reject(new Error(rs.getError()));
        } else if (status === RenderStatus.RENDERED) {
          delete pendingRenders[renderId];
          pendingRender.resolve(rs.toJSON());
        }
      });

      console.log('awaiting', getStatusInterval);
      await psetTimeout(getStatusInterval);
      console.log('awaited');
      await getRenderStatusJob();
    }
  };
}

module.exports = makeWaitForRenderedStatus;
