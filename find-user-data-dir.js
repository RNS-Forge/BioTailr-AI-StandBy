const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface({ input: fs.createReadStream('C:/Users/6point3_FA0018/.gemini/antigravity-ide/brain/900bd8e8-a48e-42b3-b162-4d6c0ab47a88/.system_generated/logs/transcript.jsonl') });
const set = new Set();
rl.on('line', line => {
  const item = JSON.parse(line);
  const text = JSON.stringify(item);
  const matches = text.match(/user-data-dir[^"]+/g);
  if (matches) {
    matches.forEach(m => set.add(m));
  }
});
rl.on('close', () => {
  console.log('All user-data-dir occurrences:', Array.from(set));
});
