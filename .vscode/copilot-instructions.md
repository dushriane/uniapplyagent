---
applyTo: "**"
---

# UniApply Agent — GitHub Copilot Instructions

This workspace contains the **UniApply Agent**: an AI-powered university application manager
built on **Notion MCP**. It automates the full journey from school exploration to post-admission
follow-up, with a special focus on undecided students.

## Architecture Overview

```
src/
├── types/index.ts          ← All TypeScript interfaces (University, Task, Essay, etc.)
├── config/index.ts         ← Load config from .env + .uniapply-config.json
├── notion/
│   ├── schemas.ts          ← Notion property definitions for all 6 databases
│   ├── client.ts           ← Notion SDK client factory
│   └── manager.ts          ← Data layer: CRUD for all databases, activity logging
├── scoring/
│   ├── FitScorer.ts        ← 0-100 Fit Score for Undecided algorithm
│   └── InterestAnalyzer.ts ← Interest pattern mining + program suggestions
├── agents/
│   ├── OnboardingAgent.ts  ← Epic 1: First-run setup wizard
│   ├── ExplorationAgent.ts ← Epic 2: URL clipping, interest logging, weekly digest
│   ├── ResearchAgent.ts    ← Epic 3: School comparison, research notes, email logging
│   ├── PreparationAgent.ts ← Epic 4: Checklists, essay personalisation, rec tracking
│   ├── DeadlineAgent.ts    ← Epic 5: Deadline scan, status auto-update, HITL confirm
│   ├── TrackingAgent.ts    ← Epic 6: Interest patterns, post-submission logging, drafts
│   └── ReportingAgent.ts   ← Epic 7: Health reports, archive, dashboard
├── UniApplyAgent.ts        ← Main orchestrator (wires all agents + cron scheduler)
└── cli.ts                  ← Commander.js CLI entry point
prompts/
├── system.md               ← System prompt for LLM + Notion MCP usage
├── essay-personalizer.md   ← AI prompt for essay personalisation
├── comparison.md           ← AI prompt for school comparison
├── health-report.md        ← AI prompt for health report
└── interest-patterns.md    ← AI prompt for interest analysis
```

## Notion Databases (auto-created by `uniapply setup`)

| Database | Key Properties |
|---|---|
| 🎓 Universities | Name, Status, Fit Score, Undecided Friendly, Curriculum Flexibility, Advising Strength |
| 📚 Programs & Majors | Name, University, Field, Undecided Friendly, Early Declaration Required |
| ✍️ Essays & Documents | Title, University, Type, Status, Word Limit, Due Date |
| ✅ Timeline & Tasks | Task, University, Type, Status, Priority, Due Date |
| 💡 Interests Log | Title, Field, Source, Strength (1-5), Tags, Date Added |
| 🔍 Activity Log | Action, Type, Target, Status, Timestamp |

## Notion MCP Tools Available

When using Copilot in this workspace with Notion MCP connected, you can:

```
# Search your universities database
notion_query_database(database_id=UNIVERSITIES_DB, filter={Status: "Applying"})

# Update a school status
notion_update_page(page_id=<uid>, properties={Status: {select: {name: "Submitted"}}})

# Add research notes to a university page
notion_append_block_children(block_id=<uid>, children=[{paragraph: {rich_text: [{text: {content: "..."}}]}}])

# Create a new interest entry
notion_create_page(parent={database_id: INTERESTS_DB}, properties={Title: "...", Field: "...", Strength: 4})

# Query overdue tasks
notion_query_database(database_id=TASKS_DB, filter={Status: "Overdue"})
```

## Fit Score Algorithm

The `FitScorer` computes a 0–100 score for each university:

| Dimension | Max Points | Notes |
|---|---|---|
| Undecided Friendly | 30 | Boolean flag ✅/❌ |
| Curriculum Flexibility | 25 | High=25, Medium=14, Low=5 |
| Advising Strength | 25 | Excellent=25, Good=18, Fair=10, Poor=0 |
| No Early Declaration | 20 | false=20, true=0, unknown=10 |

Score labels: 80–100 = Excellent Fit, 60–79 = Good Fit, 40–59 = Fair Fit, 0–39 = Poor Fit.

## Key Conventions

- **READ_ONLY mode**: Always check `config.readOnlyMode` before any Notion write.
- **Activity Logging**: Every write operation calls `notion.logActivity(...)`.
- **Error handling**: Never let activity log errors bubble up (catch silently).
- **Human-in-the-loop**: Status changes and email sends require user confirmation via `inquirer.confirm`.
- **Partial names**: University lookups use `toLowerCase().includes()` for fuzzy matching.

## Adding New Features

1. Add types to `src/types/index.ts`
2. Add Notion schema changes to `src/notion/schemas.ts`
3. Add data access methods to `src/notion/manager.ts`
4. Add logic to the appropriate agent in `src/agents/`
5. Expose via `src/UniApplyAgent.ts` and wire into `src/cli.ts`

## Example Copilot Prompts (with Notion MCP)

> "Show me all universities with Fit Score above 70"
> → Reads Universities DB, filters by Fit Score property

> "Compare MIT and Brown for an undecided student"
> → Reads both university pages from Notion, runs FitScorer, generates comparison

> "What are my top 3 interest patterns?"
> → Queries Interests Log DB, runs InterestAnalyzer, formats digest

> "I got into Stanford — update Notion"
> → Confirms with user, then updates Stanford's status to "Admitted"

> "Generate this week's digest"
> → Queries all databases, builds WeeklyDigest, writes Notion page

## Environment Variables

```bash
NOTION_TOKEN=secret_xxx        # Required
OPENAI_API_KEY=sk-xxx           # Optional — enables AI features
READ_ONLY=false                 # Safety toggle
NO_AUTO_SEND=true               # Never auto-send emails
SCHEDULE_ENABLED=false          # Enable cron jobs
```
