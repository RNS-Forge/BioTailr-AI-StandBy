/**
 * BioTailr AI StandBy - YC Work at a Startup Message Generator
 * Generates compelling, highly professional outreach messages tailored to each job.
 * Authored by Sanjay N, featuring top projects with links from ATS Resume:
 * - BioTailr AI
 * - Agentium (PyPI) (12k+ developers)
 * - AgriBridge
 * - Furry Funds AI
 * - Contributor to Faculties.ai
 */

function cleanTitle(rawTitle) {
  let t = rawTitle || '';
  t = t.replace(/\s+at\s+.*$/i, '');
  t = t.replace(/\s*\([A-Za-z0-9]+\).*$/g, '');
  return t.trim() || 'Software Engineer';
}

function cleanCompany(rawCompany, rawTitle) {
  let c = rawCompany || '';
  c = c.replace(/\s*\([A-Za-z0-9]+\).*$/g, '');
  c = c.replace(/\s*\|.*$/g, '');
  c = c.replace(/Companies\//gi, '');
  c = c.trim();
  if ((!c || c.toLowerCase() === 'startup' || c.toLowerCase() === 'yc startup') && rawTitle && rawTitle.includes(' at ')) {
    c = rawTitle.split(' at ')[1]?.split('(')[0]?.split('|')[0]?.trim() || '';
  }
  return c || 'your company';
}

function extractCompanyMission(description, companyName) {
  if (!description) {
    return `${companyName}'s mission and engineering challenges caught my attention.`;
  }

  const aboutIdx = description.toLowerCase().indexOf('about ' + companyName.toLowerCase());
  let targetText = description;
  if (aboutIdx !== -1) {
    targetText = description.substring(aboutIdx + ('about ' + companyName).length);
  }

  const lines = targetText.split('\n')
    .map(l => l.trim())
    .filter(l => {
      if (l.length < 25) return false;
      if (/^(apply|save|view job|inbox|companies|my profile|full-time|remote|sponsor|\$|₹)/i.test(l)) return false;
      if (/^[a-z0-9,\.\s]+$/i.test(l) && l.split(' ').length <= 3) return false;
      return true;
    });

  if (lines.length > 0) {
    let firstSentence = lines[0].split(/[.!?]/)[0].trim();
    if (firstSentence.length > 20 && firstSentence.length < 160) {
      return `I've been following your work closely — "${firstSentence}."`;
    }
  }

  return `${companyName}'s vision and technical direction strongly resonate with my background.`;
}

/**
 * Generate a professional, high-impact outreach message for Sanjay N based on ATS Resume.
 * @param {Object} jobInfo - { title, company, description, techStack }
 * @param {Object} profile - candidate profile from candidate-profile.json
 * @returns {string} Professional message with top projects, links, and contact info
 */
function generateYCMessage(jobInfo, profile) {
  const firstName = profile?.personal?.firstName || 'Sanjay';
  const lastName = profile?.personal?.lastName || 'N';
  const email = profile?.personal?.email || '2005sanjaynrs@gmail.com';
  const phone = profile?.personal?.phone || '+91 9361599018';
  const portfolio = profile?.personal?.portfolioUrl || 'https://rns-forge.github.io/RNS_Professional_Profile/';
  const github = profile?.personal?.githubUrl || 'https://github.com/RNS-Forge';
  const linkedin = profile?.personal?.linkedinUrl || 'https://www.linkedin.com/in/sanjay--n';

  const t = cleanTitle(jobInfo.title);
  const c = cleanCompany(jobInfo.company, jobInfo.title);
  const hook = extractCompanyMission(jobInfo.description, c);

  return `Hi! I'm ${firstName} ${lastName}, an AI & Software Engineer specializing in Agentic AI, RAG, and scalable enterprise systems.

I'm writing to express my strong interest in the ${t} role at ${c}. ${hook}

Key Projects & Contributions:
• BioTailr AI: Autonomous multi-agent job platform & desktop automation (rns-forge.github.io/BioTailr-AI)
• Agentium (PyPI): Open-source Python library for agentic AI systems, enabling 12k+ developers to deploy intelligent agents (pypi.org/project/agentium)
• Faculties.ai: Contributor & frontend developer for AI-driven academic workflow platform (faculties.ai)
• AgriBridge: Global agri-trade platform connecting farmers, exporters, and importers
• Furry Funds AI: AI-based risk screening & loan approval system (improved accuracy by 15%)

Portfolio: ${portfolio}
GitHub: ${github}
LinkedIn: ${linkedin}
Contact: ${email} | ${phone}

I would love to bring my technical drive and high startup velocity to ${c}. Looking forward to connecting!`;
}

module.exports = { generateYCMessage, cleanTitle, cleanCompany, extractCompanyMission };
