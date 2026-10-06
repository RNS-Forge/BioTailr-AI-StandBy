const { execSync } = require('child_process');

try {
  const out = execSync('powershell "Get-CimInstance Win32_Process -Filter \\"Name = \'node.exe\'\\" | Select-Object ProcessId, CommandLine | ConvertTo-Json"').toString();
  const procs = JSON.parse(out);
  const arr = Array.isArray(procs) ? procs : [procs];
  for (const p of arr) {
    if (p.CommandLine && p.CommandLine.includes('apply-runner.js') && p.ProcessId !== process.pid) {
      console.log('Terminating apply-runner PID:', p.ProcessId);
      process.kill(p.ProcessId, 'SIGKILL');
    }
  }
} catch (e) {
  console.log('Error or no process:', e.message);
}
