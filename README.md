# BioTailr AI - Standalone Desktop Auto-Apply Runner

## Executive Overview
The BioTailr AI Desktop Auto-Apply Runner is a standalone, high-performance automation utility that operates directly through the Chrome DevTools Protocol (CDP) over WebSocket. It allows candidates to execute fully autonomous, multi-job batch applications on LinkedIn Easy Apply search feeds with zero human intervention.

---

## Technical Architecture
- **Protocol:** Chrome DevTools Protocol (CDP) Runtime & DOM inspection via WebSocket.
- **Engine:** Pure Node.js built-in runtime (`http` and `WebSocket`), requiring zero third-party npm dependencies.
- **Rules Engine:** Strict adherence to candidate constraints:
  - **Education Pruning:** Strictly retains only 1 College and 1 School. Any extra or duplicate entries are automatically detected and pruned.
  - **Work Experience Pruning:** Strictly caps experience entries at maximum 3.
  - **Experience Quantification:** Automatically inputs 2 years for technical and resume-relevant questions (Python, SQL, Full Stack, AI/ML, Agents, Software Engineering); inputs 1 year for general questions; selects 0 for additional month dropdowns.
  - **Affirmative Selections:** Defaults to affirmative agreement ("Yes" / "Agree") for legal consent, qualification criteria, and willingness questions; strictly inputs "No" for visa sponsorship requirements.
  - **Submission Verification:** Automatically scrolls review modal viewports, executes submission clicks, dismisses post-application confirmation dialogs, and advances to the next search result card.

---

## Prerequisites
1. **Node.js (v18.0.0 or higher):**
   Verify installation in your terminal:
   ```bash
   node --version
   ```
   If not installed, download from [nodejs.org](https://nodejs.org/).

2. **Google Chrome:**
   Standard Google Chrome browser on Windows, macOS, or Linux.

---

## Quick Start Instructions

### Step 1: Launch Google Chrome in Debugging Mode
Google Chrome must be launched with remote debugging enabled on port `9222`.

- **On Windows (1-Click):**
  Double-click `start-chrome-debug.bat`.

- **On Windows (Manual Terminal):**
  ```powershell
  & "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:USERPROFILE\.biotailr-chrome-profile" "https://www.linkedin.com/jobs/"
  ```

- **On macOS (Terminal):**
  ```bash
  /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.biotailr-chrome-profile" "https://www.linkedin.com/jobs/"
  ```

- **On Linux (Terminal):**
  ```bash
  google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.biotailr-chrome-profile" "https://www.linkedin.com/jobs/"
  ```

### Step 2: Navigate to LinkedIn Job Search
1. In the newly opened Chrome debugging window, sign into your LinkedIn account.
2. Filter for your target role with Easy Apply enabled, for example:
   ```text
   https://www.linkedin.com/jobs/search/?keywords=Full%20Stack%20Engineer&f_AL=true
   ```
3. Keep the tab open and active.

### Step 3: Execute the Automation Runner
- **On Windows (1-Click):**
  Double-click `start-runner.bat`.

- **Cross-Platform (Terminal):**
  Open your command prompt or terminal in this folder and run:
  ```bash
  node apply-runner.js
  ```

---

## Project Structure
```
BioTailr-AI-StandBy/
├── core/
│   ├── cdp-client.js          # Chrome DevTools Protocol client & WebSocket communications
│   ├── hud-manager.js         # On-screen StandBy metrics tab & failed jobs drawer
│   └── orchestrator.js        # Multi-page batch loop & autonomous solver
├── platforms/
│   ├── base-platform.js       # Abstract base platform adapter
│   ├── platform-factory.js    # Multi-platform factory (LinkedIn, etc.)
│   └── linkedin/              # LinkedIn specific perception & solver engine
│       ├── card-selector.js   # Robust multi-key job card selector
│       ├── feed-scroller.js   # Dynamic feed scrolling engine
│       ├── index.js           # LinkedIn platform adapter entrypoint
│       ├── modal-solver.js    # Multi-step Easy Apply solver & verification
│       └── pagination.js      # Search pagination engine
├── scripts/                   # Diagnostic, debugging, and inspection utilities
├── apply-runner.js            # Main standalone runner entrypoint (instant auto-apply)
├── candidate-profile.json     # Candidate personal, work authorization & experience profile
├── start-chrome-debug.bat     # Launches Chrome with port 9222 and auto-sized viewport
├── start-runner.bat           # 1-click Windows runner execution
├── enable-windows-startup.bat # Registers StandBy as Windows startup application
├── disable-windows-startup.bat# Removes StandBy from Windows startup
└── README.md                  # System reference documentation
```

---

## StandBy On-Screen Features
- **Live Applied Counter**: Displays the number of successfully submitted job applications in prominent bold emerald digits (`#059669`).
- **Interactive Failed Jobs Inspector**: Clicking the StandBy tab opens a clean sliding drawer detailing all skipped or failed listings, showing exclusively the **Company Name** and **Job Role**.
- **Instant Local Execution**: Running `node apply-runner.js` connects directly to Chrome and immediately begins applying without requiring manual clicks or terminal prompts.
- **Draggable Everywhere**: Smooth 60fps bottom-anchored dragging across any region of the viewport.
- **Strict Aesthetic Standards**: Zero emojis, max 6px border-radius, clean slate/emerald design system.

---

## Configuration (`candidate-profile.json`)
You can customize candidate information by editing `candidate-profile.json`:

```json
{
  "personal": {
    "fullName": "Your Name",
    "email": "your.email@example.com",
    "phone": "+1 555-0199",
    "city": "Your City, State, Country",
    "linkedinUrl": "https://www.linkedin.com/in/your-profile",
    "githubUrl": "https://github.com/your-github"
  },
  "workAuth": {
    "authorizedInCountry": "Yes",
    "needSponsorship": "No"
  },
  "experience": {
    "totalYears": 2,
    "noticePeriodDays": 15,
    "currentTitle": "Full Stack Engineer",
    "currentCompany": "Your Company",
    "currentSalary": "800000",
    "expectedSalary": "1200000"
  },
  "settings": {
    "batchTarget": 0,
    "cdpPort": 9222
  }
}
```

- `batchTarget`: Number of consecutive jobs to apply for before terminating (`0` for unlimited).
- `cdpPort`: Chrome remote debugging port (default: `9222`).

---

## Troubleshooting
- **Error: "Failed to connect to Chrome on port 9222"**:
  Ensure Chrome was started with `--remote-debugging-port=9222` and that port 9222 is accessible.
- **Error: "No active job board tab detected"**:
  Make sure at least one tab in the debugging Chrome window is loaded with `linkedin.com/jobs`.

