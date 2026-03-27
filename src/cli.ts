#!/usr/bin/env node
/**
 * UniApply Agent — CLI Entry Point
 *
 * Usage:
 *   uniapply setup                          First-time workspace setup
 *   uniapply clip <url>                     Clip a university webpage
 *   uniapply status                         Show dashboard
 *   uniapply compare <schoolA> <schoolB>    Compare two schools
 *   uniapply essay <school>                 Personalise essay for a school
 *   uniapply scan                           Deadline scan
 *   uniapply digest                         Weekly exploration digest
 *   uniapply report                         Health report
 *   uniapply checklist <school>             Create application checklist
 *   uniapply interests                      Analyse interest patterns
 *   uniapply confirm <school> <status>      Mark app status after confirmation email
 *   uniapply post-submit <school> <event>   Log post-submission event
 *   uniapply archive <school>               Archive a school
 *   uniapply schedule                       Start scheduler daemon
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import inquirer from 'inquirer';
import { UniApplyAgent } from './UniApplyAgent';
import { createApiServer } from './server/apiServer';
import { runAdapterAction } from './adapters/response';
import type { University } from './types';

// ── Banner ────────────────────────────────────────────────────────────────────

function printBanner(): void {
  console.log(chalk.cyan(figlet.textSync('UniApply', { font: 'Small' })));
  console.log(chalk.gray('  AI-powered university application agent — powered by Notion MCP\n'));
}

// ── Agent singleton ────────────────────────────────────────────────────────────

let _agent: UniApplyAgent | null = null;
function getAgent(): UniApplyAgent {
  if (!_agent) _agent = new UniApplyAgent();
  return _agent;
}

async function runCliAction<T>(action: string, operation: () => Promise<T>): Promise<T> {
  const result = await runAdapterAction('cli', action, operation);
  if (!result.ok) {
    console.error(chalk.red(`[${result.error.code}] ${result.error.message}`));
    if (process.env.DEBUG_UNIAPPLY === 'true' && result.error.details !== undefined) {
      console.error(chalk.gray(JSON.stringify(result.error.details, null, 2)));
    }
    process.exit(1);
  }

  return result.data;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('uniapply')
  .description('AI-powered university application agent using Notion MCP')
  .version('1.0.0')
  .hook('preAction', () => printBanner());

// ── setup ─────────────────────────────────────────────────────────────────────

program
  .command('setup')
  .description('First-time workspace setup: creates all Notion databases and captures preferences')
  .action(async () => {
    await runCliAction('setup', () => getAgent().setup());
  });

// ── status ────────────────────────────────────────────────────────────────────

program
  .command('status')
  .description('Show dashboard: top schools, essay completion, overdue tasks')
  .action(async () => {
    await runCliAction('status', () => getAgent().showStatus());
  });

// ── clip ──────────────────────────────────────────────────────────────────────

program
  .command('clip')
  .description('Clip a university webpage into Notion with auto-scored Fit for Undecided')
  .argument('<url>', 'Full URL of the university or program page to clip')
  .action(async (url: string) => {
    await runCliAction('clip', () => getAgent().clipUrl(url));
  });

// ── compare ───────────────────────────────────────────────────────────────────

program
  .command('compare')
  .description('Compare two schools from your Notion database')
  .argument('<schoolA>', 'Name (or partial name) of the first school')
  .argument('<schoolB>', 'Name (or partial name) of the second school')
  .action(async (schoolA: string, schoolB: string) => {
    await runCliAction('compare', () => getAgent().compareSchools(schoolA, schoolB));
  });

// ── essay ─────────────────────────────────────────────────────────────────────

program
  .command('essay')
  .description('Personalise an essay draft for a specific school using its Notion data')
  .argument('<school>', 'Target school name')
  .option('-f, --file <path>', 'Path to a .txt file containing the draft (otherwise prompted)')
  .action(async (school: string, opts: { file?: string }) => {
    let draft: string;
    if (opts.file) {
      const fs = await import('fs/promises');
      draft = await fs.readFile(opts.file, 'utf-8');
    } else {
      const { text } = await inquirer.prompt<{ text: string }>([
        {
          type: 'editor',
          name: 'text',
          message: `Paste your essay draft for ${school}:`,
        },
      ]);
      draft = text;
    }
    await runCliAction('essay', () => getAgent().personalizeEssay(draft, school));
  });

// ── scan ──────────────────────────────────────────────────────────────────────

program
  .command('scan')
  .description('Deadline scan: flags urgent items and re-prioritises tasks')
  .option('--no-interactive', 'Skip interactive follow-up prompts')
  .action(async (opts: { interactive: boolean }) => {
    await runCliAction('scan', () => getAgent().scanDeadlines(opts.interactive !== false));
  });

// ── checklist ─────────────────────────────────────────────────────────────────

program
  .command('checklist')
  .description('Generate a full application checklist for a school')
  .argument('<school>', 'School name')
  .option('-d, --deadline <date>', 'Application deadline (YYYY-MM-DD)')
  .action(async (school: string, opts: { deadline?: string }) => {
    const deadline = opts.deadline ? new Date(opts.deadline) : undefined;
    await runCliAction('checklist', () => getAgent().createChecklist(school, deadline));
  });

// ── digest ────────────────────────────────────────────────────────────────────

program
  .command('digest')
  .description('Generate the weekly Exploration Digest Notion page')
  .action(async () => {
    await runCliAction('digest', () => getAgent().generateDigest());
  });

// ── report ────────────────────────────────────────────────────────────────────

program
  .command('report')
  .description('Generate Application Health Report (Notion page + CLI)')
  .action(async () => {
    await runCliAction('report', () => getAgent().generateHealthReport());
  });

// ── interests ─────────────────────────────────────────────────────────────────

program
  .command('interests')
  .description('Analyse interest patterns and surface program suggestions')
  .action(async () => {
    await runCliAction('interests', () => getAgent().analyzeInterests());
  });

// ── interest add ──────────────────────────────────────────────────────────────

program
  .command('interest')
  .description('Log a new interest entry')
  .action(async () => {
    const answers = await inquirer.prompt<{
      title: string;
      field: string;
      source: Interest['source'];
      strength: number;
      notes: string;
      url: string;
    }>([
      { type: 'input', name: 'title', message: 'Interest title (e.g. "Behavioural Economics"):', validate: (v) => v.trim() !== '' || 'Required' },
      { type: 'input', name: 'field', message: 'Field/category (e.g. "Economics"):', validate: (v) => v.trim() !== '' || 'Required' },
      {
        type: 'list',
        name: 'source',
        message: 'How did you discover this?',
        choices: ['Article', 'Video', 'Quiz', 'Conversation', 'Personal', 'Class', 'Email', 'Clip'],
      },
      {
        type: 'list',
        name: 'strength',
        message: 'Strength of interest (1=mild, 5=passionate):',
        choices: [
          { name: '1 — Mild curiosity', value: 1 },
          { name: '2 — Passing interest', value: 2 },
          { name: '3 — Genuine interest', value: 3 },
          { name: '4 — Strong interest', value: 4 },
          { name: '5 — Passionate', value: 5 },
        ],
      },
      { type: 'input', name: 'notes', message: 'Notes (optional):', default: '' },
      { type: 'input', name: 'url', message: 'Source URL (optional):', default: '' },
    ]);

    await runCliAction('interest-log', () => getAgent().logInterest(
      answers.title,
      answers.field,
      answers.source,
      answers.strength as 1 | 2 | 3 | 4 | 5,
      answers.notes || undefined,
      answers.url || undefined,
    ));
  });

// ── confirm ───────────────────────────────────────────────────────────────────

program
  .command('confirm')
  .description('Update a school status after receiving a confirmation email')
  .argument('<school>', 'School name')
  .argument(
    '<status>',
    'New status: Submitted | Admitted | Rejected | Waitlisted | Deferred',
  )
  .action(async (school: string, status: string) => {
    const validStatuses: University['status'][] = [
      'Submitted', 'Admitted', 'Rejected', 'Waitlisted', 'Deferred',
    ];
    if (!validStatuses.includes(status as University['status'])) {
      console.error(chalk.red(`Invalid status. Choose from: ${validStatuses.join(', ')}`));
      process.exit(1);
    }
    await runCliAction('confirm', () => getAgent().processConfirmation(school, status as University['status']));
  });

// ── post-submit ───────────────────────────────────────────────────────────────

program
  .command('post-submit')
  .description('Log a post-submission event (interview, decision, visit invite)')
  .argument('<school>', 'School name')
  .action(async (school: string) => {
    const { eventType } = await inquirer.prompt<{
      eventType: 'Interview Invite' | 'Decision Received' | 'Campus Visit Invite' | 'Waitlisted' | 'Scholarship Offer';
    }>([
      {
        type: 'list',
        name: 'eventType',
        message: 'Event type:',
        choices: [
          'Interview Invite',
          'Decision Received',
          'Campus Visit Invite',
          'Waitlisted',
          'Scholarship Offer',
        ],
      },
    ]);
    await runCliAction('post-submit', () => getAgent().logPostSubmission(school, eventType));
  });

// ── archive ───────────────────────────────────────────────────────────────────

program
  .command('archive')
  .description('Archive a school (keeps it searchable in Notion)')
  .argument('<school>', 'School name')
  .action(async (school: string) => {
    const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
      {
        type: 'confirm',
        name: 'confirmed',
        message: chalk.yellow(`Archive "${school}"? It will remain searchable but marked as Archived.`),
        default: true,
      },
    ]);
    if (!confirmed) { console.log(chalk.gray('Cancelled.')); return; }
    await runCliAction('archive', () => getAgent().archiveUniversity(school));
  });

// ── schedule ──────────────────────────────────────────────────────────────────

program
  .command('schedule')
  .description('Start the scheduler daemon (daily scan + Sunday reports)')
  .action(() => {
    getAgent().startScheduler();
    console.log(chalk.gray('\nScheduler running. Press Ctrl+C to stop.\n'));
    // Keep process alive
    process.stdin.resume();
  });

// ── api server ───────────────────────────────────────────────────────────────

program
  .command('api')
  .description('Start HTTP API adapter for UI integrations')
  .option('-p, --port <port>', 'Port number', '8787')
  .action(async (opts: { port: string }) => {
    const port = Number(opts.port);
    if (!Number.isInteger(port) || port <= 0) {
      console.error(chalk.red('Invalid port. Please pass a positive integer, e.g. --port 8787'));
      process.exit(1);
    }

    await runCliAction('api-start', async () => {
      const api = createApiServer(getAgent());
      await api.start(port);
      return { port };
    });

    console.log(chalk.green(`API server running at http://localhost:${port}`));
    console.log(chalk.gray('Health check: GET /health'));
    console.log(chalk.gray('Press Ctrl+C to stop.\n'));
    process.stdin.resume();
  });

// ── recommendation ────────────────────────────────────────────────────────────

program
  .command('rec')
  .description('Track a recommendation request')
  .action(async () => {
    const answers = await inquirer.prompt<{
      school: string;
      recommender: string;
      deadline: string;
      emailUrl: string;
    }>([
      { type: 'input', name: 'school', message: 'School name:', validate: (v) => v.trim() !== '' || 'Required' },
      { type: 'input', name: 'recommender', message: 'Recommender name:', validate: (v) => v.trim() !== '' || 'Required' },
      { type: 'input', name: 'deadline', message: 'Deadline (YYYY-MM-DD or blank):', default: '' },
      { type: 'input', name: 'emailUrl', message: 'Email thread URL (optional):', default: '' },
    ]);
    const deadline = answers.deadline ? new Date(answers.deadline) : undefined;
    await runCliAction('recommendation-track', () => getAgent().trackRecommendation(
      answers.school,
      answers.recommender,
      deadline,
      answers.emailUrl || undefined,
    ));
  });

// ── Type export for inline use ─────────────────────────────────────────────────
type Interest = import('./types').Interest;

// ── Parse ──────────────────────────────────────────────────────────────────────

program.parseAsync(process.argv).catch((err: Error) => {
  console.error(chalk.red('\nUnhandled error: ' + err.message));
  process.exit(1);
});
