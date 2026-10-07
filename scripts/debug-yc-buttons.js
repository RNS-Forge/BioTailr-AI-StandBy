const { generateYCMessage } = require('../platforms/yc/message-generator');

const sample = {
  title: 'Senior Software Engineer, Backend at Retell AI(W24)',
  company: 'Retell AI (W24)',
  description: 'Retell is building the AI voice layer for every business. We are replacing outdated call centers with real-time AI voice agents.'
};

const msg = generateYCMessage(sample, {});
console.log('=== GENERATED MESSAGE ===');
console.log(msg);
console.log('=== LENGTH ===');
console.log(msg.length, 'characters');
