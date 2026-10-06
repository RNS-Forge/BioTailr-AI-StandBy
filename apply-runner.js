/**
 * BioTailr AI StandBy - Autonomous Auto-Apply Runner Entrypoint
 * Platform-based architecture supporting LinkedIn, Indeed, and modern ATS engines.
 */

const fs = require('fs');
const path = require('path');
const { log, sleep, getTargetTab, connectWebSocket, cdpEval } = require('./core/cdp-client');
const PlatformFactory = require('./platforms/platform-factory');
const Orchestrator = require('./core/orchestrator');

// Load Candidate Profile Configuration
let profile = {
  personal: {
    fullName: 'Sanjay N',
    firstName: 'Sanjay',
    lastName: 'N',
    email: '2005sanjaynrs@gmail.com',
    phone: '+91 9361599018',
    city: 'Coimbatore, Tamil Nadu, India',
    linkedinUrl: 'https://www.linkedin.com/in/sanjay--n',
    githubUrl: 'https://github.com/RNS-Forge',
    portfolioUrl: 'https://rns-forge.github.io/RNS_Professional_Profile/'
  },
  workAuth: {
    authorizedInCountry: 'Yes',
    needSponsorship: 'No'
  },
  experience: {
    totalYears: 2,
    noticePeriodDays: 15,
    currentTitle: 'Full Stack & AI Engineer',
    currentCompany: 'Axodian',
    currentSalary: '800,000 INR (8 LPA)',
    expectedSalary: '1,200,000 INR (12 LPA)'
  },
  education: {
    degree: 'Bachelor of Technology - BTech',
    institution: 'Anna University / SNS College of Technology'
  },
  settings: {
    batchTarget: 0, // 0 = unlimited continuous apply
    cdpPort: 9222
  }
};

try {
  const profilePath = path.join(__dirname, 'candidate-profile.json');
  if (fs.existsSync(profilePath)) {
    const raw = fs.readFileSync(profilePath, 'utf8');
    profile = { ...profile, ...JSON.parse(raw) };
  }
} catch (e) {
  log('WARN', 'Could not parse candidate-profile.json, using defaults.');
}

const cdpPort = profile.settings?.cdpPort || 9222;

async function main() {
  log('INIT', `Connecting to Chrome DevTools Protocol at 127.0.0.1:${cdpPort}...`);

  const activeTab = await getTargetTab(cdpPort, ['linkedin.com/jobs', 'indeed.com/jobs']);
  log('CONNECTED', `Attached to tab: "${activeTab.title}" (${activeTab.url})`);

  const ws = await connectWebSocket(activeTab.webSocketDebuggerUrl);

  const platform = PlatformFactory.createPlatform(activeTab.url, ws, cdpEval, profile, { sleep, log });
  log('PLATFORM', `Active Platform Adapter: [${platform.getName()}]`);

  const orchestrator = new Orchestrator(ws, platform, profile);
  await orchestrator.run();
}

main().catch(err => {
  log('ERROR', err.message);
  process.exit(1);
});
