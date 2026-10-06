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
  handleSafetyReminder,
  pruneEducation,
  solveFormFields,
  trySubmitLinkedInModal,
  tryAdvanceLinkedInModal,
  dismissPostSubmitDialogs,
  discardIncompleteModal
} = require('./modal-solver');

class LinkedInPlatform extends BasePlatform {
  getName() {
    return 'LinkedIn';
  }

  async inspectCurrentJob() {
    return await this.cdpEval(this.ws, `(() => {
      const urlMatch = window.location.href.match(/currentJobId=(\\d+)/);
      const jobId = urlMatch ? urlMatch[1] : '';

      let title = document.querySelector('a[href*="/jobs/view/"], .job-details-jobs-unified-top-card__job-title, h1.job-details-jobs-unified-top-card__job-title, .jobs-search__job-details--container h1, .jobs-unified-top-card__job-title, .job-card-list__title, h1')?.innerText?.trim()
        || document.querySelector('.jobs-search-results-list__list-item--active .job-card-list__title, .selected .job-card-list__title, [componentkey^="job-card-component-ref-"][class*="selected"]')?.innerText?.trim()
        || 'Technical Opportunity';
      title = title.replace(/^Selected,?\\s*/i, '').replace(/\\s*\\(Verified job\\)/i, '').trim();

      let company = document.querySelector('a[href*="/company/"], .job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .job-details-jobs-unified-top-card__primary-description-container a, .job-card-container__primary-description')?.innerText?.trim()
        || document.querySelector('.jobs-search-results-list__list-item--active .job-card-container__primary-description, .selected .job-card-container__primary-description')?.innerText?.trim()
        || 'Target Company';
      company = company.replace(/^Selected,?\\s*/i, '').trim();

      const findEasyApply = () => {
        const buttons = Array.from(document.querySelectorAll('button')).filter(b => {
          if (b.offsetWidth <= 0) return false;
          if (b.closest('[componentkey^="job-card-component-ref-"]') || b.closest('.jobs-search-results-list__list-item') || b.closest('.job-card-container')) return false;
          const aria = (b.getAttribute('aria-label') || '').toLowerCase();
          const txt = (b.innerText || '').trim().toLowerCase();
          return aria.includes('easy apply') || txt === 'easy apply' || (txt.includes('easy apply') && txt.length < 30);
        });
        if (buttons.length > 0) return buttons[0];
        return document.querySelector('.jobs-apply-button, [data-control-name="jobdetails_topcard_inapply"] button, .jobs-s-apply button');
      };

      const easyBtn = findEasyApply();
      return { title, company, jobId, hasEasyApply: Boolean(easyBtn) };
    })()`);
  }

  async clickApplyButton() {
    const coords = await this.cdpEval(this.ws, `(() => {
      const buttons = Array.from(document.querySelectorAll('button')).filter(b => {
        if (b.offsetWidth <= 0) return false;
        if (b.closest('[componentkey^="job-card-component-ref-"]') || b.closest('.jobs-search-results-list__list-item') || b.closest('.job-card-container')) return false;
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        const txt = (b.innerText || '').trim().toLowerCase();
        return aria.includes('easy apply') || txt === 'easy apply' || (txt.includes('easy apply') && txt.length < 30);
      });

      const btn = buttons[0] || document.querySelector('.jobs-apply-button, [data-control-name="jobdetails_topcard_inapply"] button, .jobs-s-apply button');

      if (btn) {
        const r = btn.getBoundingClientRect();
        return { clicked: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      }
      return { clicked: false };
    })()`);

    if (coords && coords.clicked && coords.x && coords.y) {
      await new Promise(resolve => {
        this.ws.send(JSON.stringify({
          id: Math.floor(Math.random() * 1000000),
          method: 'Input.dispatchMouseEvent',
          params: { type: 'mousePressed', x: coords.x, y: coords.y, button: 'left', clickCount: 1 }
        }));
        setTimeout(() => {
          this.ws.send(JSON.stringify({
            id: Math.floor(Math.random() * 1000000),
            method: 'Input.dispatchMouseEvent',
            params: { type: 'mouseReleased', x: coords.x, y: coords.y, button: 'left', clickCount: 1 }
          }));
          setTimeout(resolve, 250);
        }, 35);
      });
      await handleSafetyReminder(this.ws, this.cdpEval);
      return true;
    }
    return Boolean(coords && coords.clicked);
  }

  async handleSafetyReminder() {
    return await handleSafetyReminder(this.ws, this.cdpEval);
  }

  async getModalStatus() {
    await handleSafetyReminder(this.ws, this.cdpEval);
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

  async discardIncompleteModal() {
    return await discardIncompleteModal(this.ws, this.cdpEval);
  }

  async selectNextJob(visitedKeys) {
    return await selectNextLinkedInCard(this.ws, this.cdpEval, visitedKeys);
  }

  async scrollFeed() {
    return await scrollLinkedInFeed(this.ws, this.cdpEval);
  }

  async goToNextPage(targetPage) {
    return await goToNextLinkedInPage(this.ws, this.cdpEval, targetPage);
  }
}

module.exports = LinkedInPlatform;
