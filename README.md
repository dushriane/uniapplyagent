# 🎓 UniApply Agent

> AI-powered university application manager built on **Notion MCP** —
> now with **dual interfaces: CLI and Web UI**.
> Automates the full journey from early exploration to admission decisions,
> with special depth for undecided students.

---

## 🎯 What's New (Phase 2+)

✨ **Web UI** — Beautiful React dashboard alongside the CLI  
📱 **Balanced Intake** — Optional profile fields for better recommendations  
🎨 **Dual Interfaces** — Choose CLI, API, or Web UI at startup  
🔧 **Preference-Aware Scoring** — Fit scores now account for your learning style, campus setting, and more

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Notion MCP](https://img.shields.io/badge/Notion-MCP-black)](https://mcp.notion.com)
[![VS Code](https://img.shields.io/badge/VS_Code-GitHub_Copilot-blue)](https://code.visualstudio.com/)

---

## ✨ What It Does

UniApply Agent orchestrates your entire college application process through Notion,
eliminating the chaos of spreadsheets, sticky notes, and missed deadlines.

| Epic | Feature |
|---|---|
| 🛠️ Onboarding | Auto-creates 6 Notion databases + a dashboard page in one command |
| 🔭 Exploration | Clips university URLs into structured Notion entries with auto-scored **Fit for Undecided** |
| 💡 Interest Discovery | Logs interests from articles / quizzes / conversations; surfaces **field patterns** and program suggestions |
| 🔬 Research | AI-powered school comparisons that read live Notion data; appends research notes |
| ✍️ Preparation | Generates per-school checklists; **AI essay personalisation** using school's Notion context |
| ⏰ Deadlines | Daily scans, priority auto-recalculation, and **human-in-the-loop** status confirmations |
| 📊 Reporting | Weekly health reports (0–100 score), exploration digests, and gap analysis |
| 🗂️ Maintenance | Archive completed apps; full activity audit log for privacy-conscious students |

---

## 🏗️ Architecture

```
UniApplyAgent (orchestrator)
├── OnboardingAgent    → creates databases, captures preferences
├── ExplorationAgent   → URL clipping, interest logging, weekly digest
├── ResearchAgent      → school comparisons, research notes
├── PreparationAgent   → checklists, essay personaliser, rec tracking
├── DeadlineAgent      → proactive scans, HITL status updates
├── TrackingAgent      → interest patterns, post-submission events
└── ReportingAgent     → health reports, archive, dashboard

NotionManager (data layer)
├── 6 auto-created databases (Universities, Programs, Essays, Tasks, Interests, ActivityLog)
└── Full CRUD with READ_ONLY guard + activity logging on every write

FitScorer       → 0–100 Fit Score for Undecided (4 weighted dimensions)
InterestAnalyzer → field frequency × strength → program suggestions + cross-field insights
```

---

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+
- A [Notion integration token](https://www.notion.so/my-integrations) (share it with your workspace page)
- Optional: OpenAI API key for AI-powered essay personalisation and comparisons

### 2. Install

```bash
git clone <repo>
cd notionmcp
npm install
cp .env.example .env
# Edit .env and add NOTION_TOKEN and optionally OPENAI_API_KEY
```

### 3. Choose Your Interface

```bash
npm run dev
# OR: npx ts-node src/cli.ts
```

You'll be greeted with a menu:

```
? Choose your interface:
  CLI (command-line)
  API Server (for web UI)
  Open Web UI (requires API server)
```

**Option A: CLI (recommended for power users)**
```bash
uniapply setup     # First-time setup
uniapply clip <url>
uniapply status
```

**Option B: Web UI (recommended for visual learners)**
```bash
npm run dev
# → Select "Open Web UI" from the menu
# → Browser opens to http://localhost:5173
```

**Option C: Headless API (for integrations)**
```bash
npm run api --port 8787
# API listening on http://localhost:8787/health
```

### 4. VS Code + Notion MCP

The `.vscode/mcp.json` connects GitHub Copilot to the Notion MCP server. After authorising:

```
# In your Copilot chat panel:
"Show me all universities with Fit Score above 70"
"Compare Brown and Bowdoin for an undecided student"
"What are my top interest patterns?"
"I submitted to Cornell — update Notion"
```

---

## 📋 Expanded Student Profile (Phase 3)

During setup, you'll now be prompted for **optional profile fields** to improve recommendations:

| Category | Fields | Example |
|----------|--------|---------|
| Academic | Intended Majors, Test Optional, Learning Style | "Computer Science, Interdisciplinary" |
| Financial | Financial Aid Need (%) | "75% (need significant aid)" |
| Lifestyle | Campus Setting, Preferred Climate, Distance From Home | "Suburban, Temperate, within 500mi" |
| Support | Advising Need Level, Accessibility Needs | "High, wheelchair accessible" |
| Communication | Communication Preference | "Email preferred, SMS OK" |

**All fields are skippable** — leave blank to use defaults.

These preferences are stored locally and mirrored to Notion, and they'll influence:
- School fit scoring (prefer schools matching your advising needs, campus setting, etc.)
- Upcoming filtering and recommendations
- Reports and dashboards

---

## 📚 CLI Reference

```bash
uniapply setup                         # First-time setup
uniapply status                        # Dashboard: top schools, essays, tasks
uniapply clip <url>                    # Clip university webpage → Notion entry
uniapply compare <schoolA> <schoolB>   # AI-powered school comparison
uniapply essay <school>                # Personalise essay draft for a school
uniapply scan                          # Deadline scan + re-prioritisation
uniapply checklist <school>            # Generate application checklist
uniapply digest                        # Weekly Exploration Digest
uniapply report                        # Application Health Report
uniapply interests                     # Interest pattern analysis
uniapply interest                      # Log a new interest entry (interactive)
uniapply confirm <school> <status>     # Update status from confirmation email
uniapply post-submit <school>          # Log interview/decision/visit events
uniapply rec                           # Track recommendation request
uniapply archive <school>              # Archive a completed application
uniapply schedule                      # Start background scheduler
uniapply api --port 8787              # Start HTTP API adapter for web UI
```

### API Adapter (for Web UI)

Start the API server from the same orchestrator used by the CLI:

```bash
npm run api
# or choose a custom port
npx ts-node src/cli.ts api --port 9000
```

Health endpoint:

```bash
curl http://localhost:8787/health
```

All API routes return normalized JSON:

```json
{
	"ok": true,
	"data": {},
	"meta": {
		"adapter": "api",
		"action": "POST /api/clip",
		"timestamp": "2026-03-27T10:00:00.000Z"
	}
}
```

---

## 🧮 Fit Score for Undecided

Each university is scored 0–100 on four dimensions:

| Dimension | Max | Details |
|---|---|---|
| Undecided Friendly | 30 | Explicit "undecided-friendly" flag on university entry |
| Curriculum Flexibility | 25 | High=25, Medium=14, Low=5 |
| Advising Strength | 25 | Excellent=25, Good=18, Fair=10, Poor=0 |
| No Early Declaration | 20 | No=20, Yes=0, Unknown=10 |

**Labels:** 80–100 = Excellent Fit · 60–79 = Good Fit · 40–59 = Fair Fit · 0–39 = Poor Fit

Run `uniapply status` to see all schools ranked by Fit Score.

---

## 💡 Interest Pattern Engine

The `InterestAnalyzer` mines your Interests Log to find:

1. **Top fields** by frequency × strength (e.g., "Psychology: 7 entries, avg 4.2/5")
2. **Cross-field insights** (e.g., "Psychology + Sustainability → Conservation Psychology")
3. **Program suggestions** mapped from 30+ academic fields
4. **Emerging themes** across different interest types

Run `uniapply interests` to see your full analysis.

---

## 🔒 Privacy & Safety

| Toggle | Default | Description |
|---|---|---|
| `READ_ONLY=true` | false | Agent never writes to Notion |
| `NO_AUTO_SEND=true` | true | Email drafts shown but never sent |
| `SCHEDULE_ENABLED=false` | false | Disable background cron jobs |

The **Activity Log** database records every action the agent takes — what it read,
what it wrote, and when. You can audit this in Notion at any time.

All destructive actions (status changes, archives) require **manual confirmation** in the CLI.

---

## 🗓️ Scheduled Jobs

When `SCHEDULE_ENABLED=true`, start the daemon with `uniapply schedule`:

| Schedule | Job |
|---|---|
| Daily @ 08:00 | Non-interactive deadline scan + task re-prioritisation |
| Sunday @ 09:00 | Exploration Digest + Application Health Report |

---

## 📁 Notion Database Schema

### Universities
`Name · URL · Location · Size · Cost Range · Fit Score · Status · Priority · Application Deadline · Early Deadline · Acceptance Rate · Undecided Friendly · Open Curriculum · First-Year Flexibility · Early Declaration Required · Curriculum Flexibility · Advising Strength · Tags · Portal URL · Notes`

### Essays & Documents
`Title · University · Type · Status · Prompt · Word Limit · Word Count · Due Date · Drive Link · Notes`

### Timeline & Tasks
`Task · University · Type · Status · Priority · Due Date · Notes · Email Thread`

### Interests Log
`Title · Type · Source · Field · Subfield · Strength · Tags · URL · Notes · Date Added`

### Activity Log
`Action · Agent Action · Type · Target · Status · Timestamp · Details`

---

## 🤖 AI Features (requires OpenAI key)

| Feature | Model | Description |
|---|---|---|
| Essay Personalisation | GPT-4o | Rewrites draft with school-specific angles from Notion |
| School Comparison | GPT-4o-mini | Narrative recommendation based on live Notion data |
| Email Drafts | GPT-4o-mini | Thank-you / follow-up emails for interviews and decisions |

All AI calls fall back gracefully to rule-based logic when no API key is configured.

---

## 🛠️ Development

```bash
npm run build           # Compile TypeScript
npm run dev             # Run CLI in dev mode (ts-node)
npm run api             # Run API adapter in dev mode
```

### Adding a New Feature
1. Add types → `src/types/index.ts`
2. Add Notion schema → `src/notion/schemas.ts`
3. Add data methods → `src/notion/manager.ts`
4. Add logic → appropriate `src/agents/*.ts`
5. Expose in orchestrator → `src/UniApplyAgent.ts`
6. Wire into CLI → `src/cli.ts`

---

## 📄 License

MIT — built for the Notion MCP challenge.
