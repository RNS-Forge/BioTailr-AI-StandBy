/**
 * BioTailr AI StandBy - LinkedIn Platform Adapter
 * Implements BasePlatform for LinkedIn search and Easy Apply automation.
 */

const BasePlatform = require('../base-platform');
const { selectNextLinkedInCard } = require('./card-selector');
const { scrollLinkedInFeed } = require('./feed-scroller');
const { goToNextLinkedInPage } = require('./pagination');
const {
  getLinkedInModalStatus,
  handleProfilePrompt,
  pruneEducation,
  solveFormFields,
  trySubmitLinkedInModal,
  tryAdvanceLinkedInModal,
  dismissPostSubmitDialogs
} = require('./modal-solver');

class LinkedInPlatform extends BasePlatform {
  getName() {
    return 'LinkedIn';
  }

  async inspectCurrentJob() {
    return await this.cdpEval(this.ws, `(() => {
      const title = document.querySelector('.job-details-jobs-unified-top-card__job-title, h1.job-details-jobs-unified-top-card__job-title, .jobs-search__job-details--container h1, .jobs-unified-top-card__job-title, .job-card-list__title, h1')?.innerText?.trim()
        || document.querySelector('.jobs-search-results-list__list-item--active .job-card-list__title, .selected .job-card-list__title')?.innerText?.trim()
        || 'Technical Opportunity';
      const company = document.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .job-details-jobs-unified-top-card__primary-description-container a, .job-card-container__primary-description')?.innerText?.trim()
        || document.querySelector('.jobs-search-results-list__list-item--active .job-card-container__primary-description, .selected .job-card-container__primary-description')?.innerText?.trim()
        || 'Target Company';
      const easyBtn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').toLowerCase().includes('easy apply') && b.offsetWidth > 0);
      return { title, company, hasEasyApply: Boolean(easyBtn) };
    })()`);
  }

  async clickApplyButton() {
    return await this.cdpEval(this.ws, `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').toLowerCase().includes('easy apply') && b.offsetWidth > 0);
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    })()`);
  }

  async getModalStatus() {
    return await getLinkedInModalStatus(this.ws, this.cdpEval);
  }

  async solveCurrentStep(stepNumber, stepStatus) {
    // 1. Intercept profile update dialog if open
    const promptHandled = await handleProfilePrompt(this.ws, this.cdpEval);
    if (promptHandled) {
      if (this.helpers.sleep) await this.helpers.sleep(350);
    }

    // 2. Education pruning if education step
    if (stepStatus && stepStatus.isEducation) {
      await pruneEducation(this.ws, this.cdpEval);
      if (this.helpers.sleep) await this.helpers.sleep(300);
    }

    // 3. Solve all inputs, selects, radios, checkboxes, and sub-forms
    await solveFormFields(this.ws, this.cdpEval, this.profile);
  }

  async trySubmit() {
    return await trySubmitLinkedInModal(this.ws, this.cdpEval);
  }

  async tryAdvance() {
    return await tryAdvanceLinkedInModal(this.ws, this.cdpEval);
  }

  async dismissPostSubmit() {
    return await dismissPostSubmitDialogs(this.ws, this.cdpEval);
  }

  async selectNextJob(visitedKeys) {
    return await selectNextLinkedInCard(this.ws, this.cdpEval, visitedKeys);
  }

  async scrollFeed() {
    return await scrollLinkedInFeed(this.ws, this.cdpEval);
  }

  async goToNextPage() {
    return await goToNextLinkedInPage(this.ws, this.cdpEval);
  }
}

module.exports = LinkedInPlatform;
