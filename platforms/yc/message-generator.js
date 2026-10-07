/**
 * BioTailr AI StandBy - YC Work at a Startup Message Generator
 * Generates personalized, human-like outreach messages for each job application.
 * Messages are tailored to company description, role, and tech stack.
 */

/**
 * Generate a compelling, personalized message for a YC startup job application.
 * @param {Object} jobInfo - { title, company, description, techStack, stage }
 * @param {Object} profile - candidate profile from candidate-profile.json
 * @returns {string} A personalized 200-500 char message
 */
function generateYCMessage(jobInfo, profile) {
  const { title = '', company = '', description = '', techStack = '' } = jobInfo;
  const firstName = profile?.personal?.firstName || 'Sanjay';
  const lastName = profile?.personal?.lastName || 'N';
  const currentRole = profile?.experience?.currentTitle || 'Full Stack & AI Engineer';
  const currentCompany = profile?.experience?.currentCompany || 'Axodian';
  const expYears = profile?.experience?.totalYears || 1;
  const email = profile?.personal?.email || '2005sanjaynrs@gmail.com';
  const portfolio = profile?.personal?.portfolioUrl || 'https://rns-forge.github.io/RNS_Professional_Profile/';
  const github = profile?.personal?.githubUrl || 'https://github.com/RNS-Forge';

  const descLower = description.toLowerCase();
  const titleLower = title.toLowerCase();
  const compLower = company.toLowerCase();
  const techLower = techStack.toLowerCase();

  // Detect domain / tech focus for personalization
  const isAI = /ai|llm|machine learning|nlp|gpt|agent|genai|generative/i.test(descLower + titleLower + techLower);
  const isFullStack = /full.?stack|frontend|backend|react|node|fastapi|django|next\.?js/i.test(descLower + titleLower + techLower);
  const isInfra = /infrastructure|devops|cloud|kubernetes|aws|gcp|azure|platform engineer/i.test(descLower + titleLower + techLower);
  const isFintech = /fintech|finance|payment|insurance|banking|trading|crypto/i.test(descLower + compLower);
  const isDataEng = /data engineer|data pipeline|etl|spark|airflow|dbt|analytics/i.test(descLower + titleLower);
  const isFoundingEng = /founding engineer|first engineer|early engineer|seed|pre-seed/i.test(descLower + titleLower);

  // Company-specific hook from description
  const companyHook = extractCompanyHook(description, company);

  // Role-specific value proposition
  let roleProof = '';
  if (isAI) {
    roleProof = `At Axodian, I architected production LLM agent pipelines, built RAG systems with vector search, and shipped AI-powered APIs serving real users. I live at the intersection of AI research and engineering execution.`;
  } else if (isDataEng) {
    roleProof = `At Axodian, I built end-to-end data pipelines, designed PostgreSQL schemas for analytics, and created FastAPI endpoints that power real-time dashboards. I thrive on making messy data reliable and fast.`;
  } else if (isInfra) {
    roleProof = `At Axodian, I set up CI/CD pipelines, containerized services with Docker, and optimised cloud deployments. I love building the infrastructure layer that lets product teams move fast without breaking things.`;
  } else if (isFintech) {
    roleProof = `At Axodian, I built secure, high-throughput backend services with Python and FastAPI, integrated third-party APIs, and shipped reliable payment and data flows. I understand the weight of correctness in fintech systems.`;
  } else if (isFoundingEng) {
    roleProof = `I am exactly the kind of engineer who thrives in zero-to-one environments. At Axodian I wore every hat — backend, frontend, AI, and deployment — and I am ready to do it again from day one at ${company}.`;
  } else {
    roleProof = `At Axodian, I built production-grade full-stack applications with Python, FastAPI, React, and PostgreSQL. I move fast, take ownership end-to-end, and ship things that work.`;
  }

  // Message templates - pick based on detected domain
  let message = '';

  if (isAI && isFoundingEng) {
    message = `Hi! I am ${firstName} ${lastName}, a ${currentRole} with ${expYears} year of experience building LLM-powered systems and agentic AI workflows in production at ${currentCompany}. ${companyHook} The ${title} role is exactly what I have been looking for — a place where I can help define the architecture, ship fast, and build something genuinely new. I know Python, FastAPI, React, and modern AI toolchains deeply. I would love to be part of what you are building. Portfolio: ${portfolio}`;
  } else if (isAI) {
    message = `Hi! I am ${firstName} ${lastName}, a ${currentRole} passionate about building AI systems that actually work in production. At ${currentCompany}, I built LLM agent pipelines, integrated vector databases, and shipped generative AI APIs serving real users. ${companyHook} I am excited about the ${title} role and believe my background aligns closely with what you need. Would love to connect. Portfolio: ${portfolio}`;
  } else if (isFoundingEng) {
    message = `Hi! I am ${firstName} ${lastName}, a ${currentRole} who loves building from 0 to 1. ${companyHook} I am drawn to the ${title} role because I want to work somewhere that is still defining its foundations — where every line of code I write matters. I have shipped production full-stack systems in Python, FastAPI, React, and SQL. Let's build something great together. GitHub: ${github}`;
  } else if (isDataEng) {
    message = `Hi! I am ${firstName}, a ${currentRole} with hands-on experience building reliable data pipelines and backend systems. ${companyHook} I am excited about the ${title} opportunity — I believe clean, fast data infrastructure is the competitive advantage most companies underestimate. At ${currentCompany} I built exactly that. Would love to discuss how I can help ${company}. Portfolio: ${portfolio}`;
  } else {
    message = `Hi! I am ${firstName} ${lastName}, a ${currentRole} with ${expYears} year of hands-on experience in Python, FastAPI, React, and AI integrations. ${companyHook} The ${title} role at ${company} immediately caught my attention — I am the kind of engineer who takes full ownership and ships. I thrive in high-velocity startup environments and would love to bring that energy to your team. Let's connect! Email: ${email}`;
  }

  // Ensure message is within a good length (50-600 chars)
  if (message.length > 600) {
    message = message.substring(0, 597) + '...';
  }

  return message;
}

/**
 * Extract a 1-sentence hook from the company description to personalize the message.
 */
function extractCompanyHook(description, company) {
  if (!description || description.length < 30) {
    return `${company} looks like a place where I can make a real impact.`;
  }

  // Try to grab the first meaningful sentence about the mission
  const sentences = description.split(/[.!?]/).map(s => s.trim()).filter(s => s.length > 30 && s.length < 200);
  const missionSentence = sentences.find(s =>
    /build|creat|solv|defin|reinvent|transform|power|enable|help|trillion|billion|new way|changing|future/i.test(s)
  ) || sentences[0];

  if (missionSentence) {
    return `What excites me most is that ${company} is ${missionSentence.toLowerCase().replace(/^we('?re| are) /, '').replace(/^[a-z]/, c => c.toLowerCase())} — that's a mission I want to be part of.`;
  }

  return `${company} is building something I genuinely believe in, which is rare.`;
}

module.exports = { generateYCMessage, extractCompanyHook };
