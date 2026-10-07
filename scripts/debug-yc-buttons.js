const { generateYCMessage } = require('../platforms/yc/message-generator');

const jobs = [
  {
    title: 'Senior Software Engineer, Backend at Retell AI(W24)',
    company: 'Retell AI (W24)',
    description: 'Retell is building the AI voice layer for every business. We are replacing outdated call centers with real-time AI voice agents.'
  },
  {
    title: 'Software Engineer - Infrastructure',
    company: 'Emergent (S24)',
    description: 'Emergent enables anyone to build production software by describing what they want in natural language.'
  }
];

jobs.forEach((j, i) => {
  console.log(`\n--- SAMPLE MESSAGE ${i + 1} ---`);
  console.log(generateYCMessage(j, {}));
});
