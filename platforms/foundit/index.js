/**
 * BioTailr AI StandBy - Foundit (Monster) Platform Adapter
 * Implements BasePlatform for foundit.in, foundit.sg, and monsterindia.com
 * Handles Quick Apply, experience/CTC screening, multi-step subforms, and feed pagination.
 */

const BasePlatform = require('../base-platform');

class FounditPlatform extends BasePlatform {
  getName() {
    return 'Foundit';
  }

  /**
   * Inspect currently selected job on Foundit
   */
  async inspectCurrentJob() {
    return await this.cdpEval(this.ws, `(() => {
      const titleEl = document.querySelector('.jobTitle, .title, h1, [data-testid="job-title"]');
      const companyEl = document.querySelector('.companyName, .company, [data-testid="company-name"]');
      const locEl = document.querySelector('.location, .jobLocation, [data-testid="job-location"]');
      const descEl = document.querySelector('.jobDescription, .job-desc, [data-testid="job-desc"]');

      return {
        title: titleEl ? titleEl.textContent.trim() : 'Unknown Role',
        company: companyEl ? companyEl.textContent.trim() : 'Unknown Company',
        location: locEl ? locEl.textContent.trim() : '',
        descriptionSnippet: descEl ? descEl.textContent.trim().slice(0, 500) : '',
        key: window.location.href
      };
    })()`);
  }

  /**
   * Click the primary Apply or Quick Apply button on Foundit
   */
  async clickApplyButton() {
    return await this.cdpEval(this.ws, `(() => {
      const applySelectors = [
        'button.applyBtn',
        'button[data-testid="quick-apply-btn"]',
        'button.quickApply',
        'button:not([disabled])',
        'a.applyBtn',
        '.btn-apply'
      ];

      for (const sel of applySelectors) {
        const btns = Array.from(document.querySelectorAll(sel));
        const applyBtn = btns.find(b => {
          const txt = b.textContent.toLowerCase();
          return (txt.includes('quick apply') || txt.includes('apply now') || txt.includes('apply')) && !txt.includes('applied');
        });
        if (applyBtn) {
          applyBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          applyBtn.click();
          return { clicked: true, text: applyBtn.textContent.trim() };
        }
      }
      return { clicked: false, reason: 'No active Apply button found' };
    })()`);
  }

  /**
   * Check if Quick Apply modal is open
   */
  async getModalStatus() {
    return await this.cdpEval(this.ws, `(() => {
      const modal = document.querySelector('.modal-content, [role="dialog"], .quick-apply-modal, .applyModal');
      if (!modal) return { isOpen: false };

      const isVisible = modal.offsetParent !== null;
      return {
        isOpen: isVisible,
        hasSubmit: !!modal.querySelector('button[type="submit"], button.submit-btn')
      };
    })()`);
  }

  /**
   * Solve current step inputs in the Foundit application modal
   */
  async solveCurrentStep(stepNumber = 1) {
    const prof = this.profile || {};
    return await this.cdpEval(this.ws, `((profile) => {
      const modal = document.querySelector('.modal-content, [role="dialog"], .quick-apply-modal, .applyModal') || document.body;
      const inputs = modal.querySelectorAll('input:not([type="hidden"]), select, textarea');
      let solvedCount = 0;

      inputs.forEach(el => {
        if (el.value) return; // already has value

        const label = (el.name || el.placeholder || el.getAttribute('aria-label') || el.id || '').toLowerCase();

        if (label.includes('name')) {
          el.value = profile.fullName || 'Candidate';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          solvedCount++;
        } else if (label.includes('mail')) {
          el.value = profile.email || '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          solvedCount++;
        } else if (label.includes('phone') || label.includes('mobile')) {
          el.value = profile.phone || '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          solvedCount++;
        } else if (label.includes('ctc') || label.includes('salary')) {
          el.value = 'Competitive / Market Standard';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          solvedCount++;
        } else if (label.includes('notice')) {
          el.value = 'Immediate / 15 Days';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          solvedCount++;
        } else if (label.includes('location') || label.includes('city')) {
          el.value = profile.location || 'Remote';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          solvedCount++;
        } else if (label.includes('experience') || label.includes('exp')) {
          el.value = '5';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          solvedCount++;
        }
      });

      return { success: true, solvedCount };
    })(${JSON.stringify(prof)})`);
  }

  /**
   * Submit the Foundit application
   */
  async trySubmit() {
    return await this.cdpEval(this.ws, `(() => {
      const modal = document.querySelector('.modal-content, [role="dialog"], .quick-apply-modal') || document.body;
      const btns = Array.from(modal.querySelectorAll('button, input[type="submit"]'));
      const submitBtn = btns.find(b => {
        const txt = (b.textContent || b.value || '').toLowerCase();
        return txt.includes('submit') || txt.includes('complete application') || txt.includes('send application');
      });

      if (submitBtn) {
        submitBtn.click();
        return { submitted: true };
      }
      return { submitted: false };
    })()`);
  }

  /**
   * Try to advance to Next step in Foundit modal
   */
  async tryAdvance() {
    return await this.cdpEval(this.ws, `(() => {
      const modal = document.querySelector('.modal-content, [role="dialog"], .quick-apply-modal') || document.body;
      const btns = Array.from(modal.querySelectorAll('button'));
      const nextBtn = btns.find(b => {
        const txt = b.textContent.toLowerCase();
        return txt.includes('next') || txt.includes('continue');
      });

      if (nextBtn) {
        nextBtn.click();
        return { advanced: true };
      }
      return { advanced: false };
    })()`);
  }

  /**
   * Dismiss post-submission success dialog
   */
  async dismissPostSubmit() {
    return await this.cdpEval(this.ws, `(() => {
      const closeBtn = document.querySelector('.modal-close, button[aria-label="Close"], .close-btn');
      if (closeBtn) {
        closeBtn.click();
        return { dismissed: true };
      }
      return { dismissed: false };
    })()`);
  }

  /**
   * Select next unvisited job card in Foundit search results feed
   */
  async selectNextJob(visitedKeys = []) {
    return await this.cdpEval(this.ws, `((visited) => {
      const cards = Array.from(document.querySelectorAll('.cardContainer, .srpResultCard, [data-job-id], article'));
      for (const card of cards) {
        const id = card.getAttribute('data-job-id') || card.id || card.querySelector('a')?.href;
        if (id && !visited.includes(id)) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.click();
          return { selected: true, key: id };
        }
      }
      return { selected: false };
    })(${JSON.stringify(visitedKeys)})`);
  }

  /**
   * Scroll Foundit job listings feed
   */
  async scrollFeed() {
    return await this.cdpEval(this.ws, `(() => {
      window.scrollBy({ top: 600, behavior: 'smooth' });
      return { scrolled: true };
    })()`);
  }

  /**
   * Navigate to next search results page on Foundit
   */
  async goToNextPage() {
    return await this.cdpEval(this.ws, `(() => {
      const nextBtn = document.querySelector('.pagination-next, [title="Next"], a.next-page, button.next');
      if (nextBtn) {
        nextBtn.click();
        return { success: true };
      }
      return { success: false };
    })()`);
  }
}

module.exports = FounditPlatform;
