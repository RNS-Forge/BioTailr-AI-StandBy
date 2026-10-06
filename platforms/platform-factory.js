/**
 * BioTailr AI StandBy - Platform Factory
 * Detects the active job portal from the browser tab URL and returns the appropriate platform adapter.
 */

const LinkedInPlatform = require('./linkedin');
const IndeedPlatform = require('./indeed');

class PlatformFactory {
  static createPlatform(tabUrl, ws, cdpEval, profile, helpers = {}) {
    const url = (tabUrl || '').toLowerCase();

    if (url.includes('linkedin.com')) {
      return new LinkedInPlatform(ws, cdpEval, profile, helpers);
    }

    if (url.includes('indeed.com')) {
      return new IndeedPlatform(ws, cdpEval, profile, helpers);
    }

    // Default to LinkedIn
    return new LinkedInPlatform(ws, cdpEval, profile, helpers);
  }
}

module.exports = PlatformFactory;
