'use strict';

function recoveryAction(acceptedLaunch) {
  return acceptedLaunch ? 'reload-app' : 'retry-launch';
}

function shouldHonorRetry(pageKind, currentUrl) {
  return pageKind === 'error' && String(currentUrl || '').startsWith('data:');
}

function shouldReportUnexpectedExit({ gen, currentGen, quitting, expectingExit, acceptedLaunch }) {
  return gen === currentGen && !quitting && !expectingExit && !!acceptedLaunch;
}

module.exports = { recoveryAction, shouldHonorRetry, shouldReportUnexpectedExit };
