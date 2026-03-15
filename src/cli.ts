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
    try {
      await getAgent().setup();
    } catch (err: unknown) {
      console.error(chalk.red('Setup failed: ' + (err as Error).message));
      process.exit(1);
    }
  });

// ── status ────────────────────────────────────────────────────────────────────

program
  .command('status')
  .description('Show dashboard: top schools, essay completion, overdue tasks')
  .action(async () => {
    try {
      await getAgent().showStatus();
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

// ── clip ──────────────────────────────────────────────────────────────────────

program
  .command('clip')
  .description('Clip a university webpage into Notion with auto-scored Fit for Undecided')
  .argument('<url>', 'Full URL of the university or program page to clip')
  .action(async (url: string) => {
    try {
      await getAgent().clipUrl(url);
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

// ── compare ───────────────────────────────────────────────────────────────────

program
  .command('compare')
  .description('Compare two schools from your Notion database')
  .argument('<schoolA>', 'Name (or partial name) of the first school')
  .argument('<schoolB>', 'Name (or partial name) of the second school')
  .action(async (schoolA: string, schoolB: string) => {
    try {
      await getAgent().compareSchools(schoolA, schoolB);
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
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
    try {
      await getAgent().personalizeEssay(draft, school);
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

// ── scan ──────────────────────────────────────────────────────────────────────

program
  .command('scan')
  .description('Deadline scan: flags urgent items and re-prioritises tasks')
  .option('--no-interactive', 'Skip interactive follow-up prompts')
  .action(async (opts: { interactive: boolean }) => {
    try {
      await getAgent().scanDeadlines(opts.interactive !== false);
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

// ── checklist ─────────────────────────────────────────────────────────────────

program
  .command('checklist')
  .description('Generate a full application checklist for a school')
  .argument('<school>', 'School name')
  .option('-d, --deadline <date>', 'Application deadline (YYYY-MM-DD)')
  .action(async (school: string, opts: { deadline?: string }) => {
    const deadline = opts.deadline ? new Date(opts.deadline) : undefined;
    try {
      await getAgent().createChecklist(school, deadline);
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

// ── digest ────────────────────────────────────────────────────────────────────

program
  .command('digest')
  .description('Generate the weekly Exploration Digest Notion page')
  .action(async () => {
    try {
      await getAgent().generateDigest();
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

// ── report ────────────────────────────────────────────────────────────────────

program
  .command('report')
  .description('Generate Application Health Report (Notion page + CLI)')
  .action(async () => {
    try {
      await getAgent().generateHealthReport();
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

// ── interests ─────────────────────────────────────────────────────────────────

program
  .command('interests')
  .description('Analyse interest patterns and surface program suggestions')
  .action(async () => {
    try {
      await getAgent().analyzeInterests();
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
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

    try {
      await getAgent().logInterest(
        answers.title,
        answers.field,
        answers.source,
        answers.strength as 1 | 2 | 3 | 4 | 5,
        answers.notes || undefined,
        answers.url || undefined,
      );
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
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
    try {
      await getAgent().processConfirmation(school, status as University['status']);
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
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
    try {
      await getAgent().logPostSubmission(school, eventType);
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
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
    try {
      await getAgent().archiveUniversity(school);
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
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
    try {
      await getAgent().trackRecommendation(answers.school, answers.recommender, deadline, answers.emailUrl || undefined);
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

// ── Type export for inline use ─────────────────────────────────────────────────
type Interest = import('./types').Interest;

// ── Parse ──────────────────────────────────────────────────────────────────────

program.parseAsync(process.argv).catch((err: Error) => {
  console.error(chalk.red('\nUnhandled error: ' + err.message));
  process.exit(1);
});
