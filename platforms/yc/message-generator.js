/**
 * BioTailr AI StandBy - YC Work at a Startup Message Generator
 * Generates compelling, highly professional outreach messages tailored to each job.
 * Fully dynamic based on candidate profile and portfolio projects.
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
 * Generate a professional, high-impact outreach message dynamically based on candidate profile.
 * @param {Object} jobInfo - { title, company, description, techStack }
 * @param {Object} profile - candidate profile from candidate-profile.json
 * @returns {string} Professional message with top projects, links, and contact info
 */
function generateYCMessage(jobInfo, profile) {
  const firstName = profile?.personal?.firstName || profile?.personal?.fullName?.split(' ')[0] || 'Candidate';
  const lastName = profile?.personal?.lastName || profile?.personal?.fullName?.split(' ').slice(1).join(' ') || '';
  const fullName = profile?.personal?.fullName || [firstName, lastName].filter(Boolean).join(' ') || 'Candidate';
  const email = profile?.personal?.email || '';
  const phone = profile?.personal?.phone || '';
  const portfolio = profile?.personal?.portfolioUrl || profile?.personal?.website || '';
  const github = profile?.personal?.githubUrl || '';
  const linkedin = profile?.personal?.linkedinUrl || '';
  const currentTitle = profile?.experience?.currentTitle || 'Software Engineer';

  const t = cleanTitle(jobInfo.title);
  const c = cleanCompany(jobInfo.company, jobInfo.title);
  const hook = extractCompanyMission(jobInfo.description, c);

  let projectsSection = '';
  if (Array.isArray(profile?.projects) && profile.projects.length > 0) {
    const projLines = profile.projects.slice(0, 5).map(p => {
      const name = p.name || p.title || 'Project';
      const desc = p.description || p.summary || '';
      const url = p.url || p.link || '';
      return `• ${name}${url ? ` (${url})` : ''}: ${desc}`;
    });
    projectsSection = `\nKey Projects & Contributions:\n${projLines.join('\n')}\n`;
  }

  const links = [];
  if (portfolio) links.push(`Portfolio: ${portfolio}`);
  if (github) links.push(`GitHub: ${github}`);
  if (linkedin) links.push(`LinkedIn: ${linkedin}`);
  const contactLine = [email, phone].filter(Boolean).join(' | ');
  if (contactLine) links.push(`Contact: ${contactLine}`);
  const linksSection = links.length ? `\n${links.join('\n')}\n` : '';

  return `Hi! I'm ${fullName}, a ${currentTitle}.

I'm writing to express my strong interest in the ${t} role at ${c}. ${hook}
${projectsSection}${linksSection}
I would love to bring my technical drive and high startup velocity to ${c}. Looking forward to connecting!`;
}

module.exports = { generateYCMessage, cleanTitle, cleanCompany, extractCompanyMission };
