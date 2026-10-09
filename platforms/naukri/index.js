/**
 * BioTailr AI StandBy - Naukri Platform Adapter
 * Implements BasePlatform for naukri.com search results, job detail views,
 * fast 1-click apply, recruiter chatbots, and multi-page automated applications.
 */

const BasePlatform = require('../base-platform');
const {
  inspectNaukriJob,
  clickNaukriApplyButton,
  selectNextNaukriCard
} = require('./card-selector');
const { scrollNaukriFeed } = require('./feed-scroller');
const { goToNextNaukriPage } = require('./pagination');
const {
  getNaukriModalStatus,
  solveNaukriModal,
  trySubmitNaukriModal,
  tryAdvanceNaukriModal,
  dismissNaukriPostSubmit,
  discardNaukriIncompleteModal
} = require('./modal-solver');

class NaukriPlatform extends BasePlatform {
  getName() {
    return 'Naukri';
  }

  async inspectCurrentJob() {
    return await inspectNaukriJob(this.ws, this.cdpEval);
  }

  async clickApplyButton() {
    return await clickNaukriApplyButton(this.ws, this.cdpEval);
  }

  async getModalStatus() {
    return await getNaukriModalStatus(this.ws, this.cdpEval);
  }

  async solveCurrentStep(stepNumber, stepStatus) {
    const result = await solveNaukriModal(this.ws, this.cdpEval, this.profile);
    if (this.helpers.sleep) {
      await this.helpers.sleep(400);
    }
    return result;
  }

  async trySubmit() {
    return await trySubmitNaukriModal(this.ws, this.cdpEval);
  }

  async tryAdvance() {
    return await tryAdvanceNaukriModal(this.ws, this.cdpEval);
  }

  async dismissPostSubmit() {
    return await dismissNaukriPostSubmit(this.ws, this.cdpEval);
  }

  async discardIncompleteModal() {
    return await discardNaukriIncompleteModal(this.ws, this.cdpEval);
  }

  async selectNextJob(visitedKeys) {
    return await selectNextNaukriCard(this.ws, this.cdpEval, visitedKeys);
  }

  async scrollFeed() {
    return await scrollNaukriFeed(this.ws, this.cdpEval);
  }

  async goToNextPage(targetPage) {
    return await goToNextNaukriPage(this.ws, this.cdpEval, targetPage);
  }
}

module.exports = NaukriPlatform;
