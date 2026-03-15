/**
 * OnboardingAgent — Epic 1
 *
 * Responsibilities:
 *  • First-run workspace detection
 *  • Auto-create all 6 Notion databases + dashboard page
 *  • Capture and persist student preferences
 *  • Write initial Settings page with toggle explanations
 */

import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { NotionManager } from '../notion/manager';
import { savePreferences } from '../config';
import type { StudentPreferences } from '../types';

export class OnboardingAgent {
  constructor(private readonly notion: NotionManager) {}

  /**
   * Interactive onboarding wizard.
   * Prompts for a Notion parent page ID, creates databases, captures prefs.
   */
  async run(): Promise<void> {
    console.log(chalk.bold.cyan('\n🎓  UniApply — First-Time Setup\n'));
    console.log(
      chalk.gray(
        'This wizard will create 6 Notion databases inside a page you specify.\n' +
          'Make sure your Notion integration has been shared with that page.\n',
      ),
    );

    // ── Step 1: Parent page ID ──────────────────────────────────────────────
    const { parentPageId } = await inquirer.prompt<{ parentPageId: string }>([
      {
        type: 'input',
        name: 'parentPageId',
        message: 'Paste the Notion page ID (or full page URL) to use as the root workspace:',
        validate: (v: string) => (v.trim().length > 0 ? true : 'Required'),
        filter: (v: string) => {
          // Extract the bare UUID if a full URL was pasted
          const match = v.match(/([a-f0-9]{32}|[a-f0-9-]{36})/i);
          return match ? match[1].replace(/-/g, '') : v.trim();
        },
      },
    ]);

    // ── Step 2: Create databases ────────────────────────────────────────────
    const spinner = ora('Creating databases in Notion…').start();
    let ids;
    try {
      ids = await this.notion.createAllDatabases(parentPageId);
      await this.notion.createDashboardPage(parentPageId);
      spinner.succeed(chalk.green('All 6 databases created and dashboard page ready!'));
    } catch (err: unknown) {
      spinner.fail(chalk.red('Failed to create databases'));
      console.error(chalk.gray((err as Error).message));
      return;
    }

    // ── Step 3: Capture student preferences ────────────────────────────────
    console.log(chalk.bold('\n📋  Student Preferences\n') + chalk.gray('These help us filter and prioritise schools for you.\n'));

    const prefs = await inquirer.prompt<StudentPreferences & { locationRaw: string; sizeRaw: string[] }>([
      {
        type: 'input',
        name: 'locationRaw',
        message: 'Preferred region(s) for school location (comma-separated, or leave blank):',
        default: '',
      },
      {
        type: 'number',
        name: 'maxTuition',
        message: 'Maximum annual tuition budget (USD, or 0 for no limit):',
        default: 0,
      },
      {
        type: 'checkbox',
        name: 'sizeRaw',
        message: 'Preferred school size(s):',
        choices: ['Small (<5k)', 'Medium (5k–15k)', 'Large (15k–30k)', 'Very Large (30k+)'],
      },
      {
        type: 'confirm',
        name: 'undecidedFriendly',
        message: 'Prioritise undecided-friendly schools?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'strongAdvising',
        message: 'Prioritise strong academic advising?',
        default: true,
      },
      {
        type: 'number',
        name: 'gpa',
        message: 'Current GPA (leave 0 to skip):',
        default: 0,
      },
      {
        type: 'number',
        name: 'satScore',
        message: 'SAT score (leave 0 to skip):',
        default: 0,
      },
      {
        type: 'number',
        name: 'targetApplicationCount',
        message: 'How many schools do you plan to apply to?',
        default: 12,
      },
    ]);

    const preferences: Partial<StudentPreferences> = {
      locationPreferences: prefs.locationRaw
        ? prefs.locationRaw.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [],
      maxTuition: (prefs.maxTuition as unknown as number) > 0 ? (prefs.maxTuition as unknown as number) : undefined,
      schoolSizePreference: (prefs.sizeRaw as unknown as string[]).length
        ? (prefs.sizeRaw as unknown as string[]) as StudentPreferences['schoolSizePreference']
        : undefined,
      undecidedFriendly: prefs.undecidedFriendly,
      strongAdvising: prefs.strongAdvising,
      gpa: (prefs.gpa as unknown as number) > 0 ? (prefs.gpa as unknown as number) : undefined,
      satScore: (prefs.satScore as unknown as number) > 0 ? (prefs.satScore as unknown as number) : undefined,
      targetApplicationCount: prefs.targetApplicationCount as unknown as number,
    };

    savePreferences(preferences);

    // ── Step 4: Write Settings page ─────────────────────────────────────────
    try {
      await this.createSettingsPage(parentPageId, preferences as StudentPreferences);
    } catch {
      // non-critical
    }

    // ── Done ─────────────────────────────────────────────────────────────────
    console.log(chalk.bold.green('\n✅  Setup complete!\n'));
    console.log(chalk.white('Database IDs saved to .uniapply-config.json\n'));
    console.log(chalk.cyan('Quick-start commands:'));
    console.log(chalk.gray('  uniapply clip <url>     — add a university from a webpage'));
    console.log(chalk.gray('  uniapply scan           — check deadlines'));
    console.log(chalk.gray('  uniapply digest         — weekly exploration digest'));
    console.log(chalk.gray('  uniapply report         — full health report'));
    console.log(chalk.gray('  uniapply status         — dashboard summary\n'));

    console.log(chalk.bold('Database IDs created:'));
    Object.entries(ids).forEach(([key, id]) => {
      if (id) console.log(chalk.gray(`  ${key.padEnd(20)} ${id}`));
    });
    console.log();
  }

  private async createSettingsPage(
    parentId: string,
    prefs: StudentPreferences,
  ): Promise<void> {
    const content = [
      '# ⚙️  UniApply Agent — Settings',
      '',
      '## Safety Toggles',
      '| Toggle | Current Value | Description |',
      '|--------|--------------|-------------|',
      '| READ_ONLY | false | When true, agent never writes to Notion |',
      '| NO_AUTO_SEND | true | When true, email drafts shown but never sent |',
      '',
      '## Student Preferences',
      `- Undecided Friendly: ${prefs.undecidedFriendly}`,
      `- Strong Advising: ${prefs.strongAdvising}`,
      `- Target Applications: ${prefs.targetApplicationCount ?? 12}`,
      `- Location: ${prefs.locationPreferences?.join(', ') || 'Any'}`,
      `- Max Tuition: ${prefs.maxTuition ? '$' + prefs.maxTuition.toLocaleString() : 'None'}`,
      '',
      '## Access & Audit',
      'All agent actions are logged in the 🔍 Activity Log database.',
      'Review it any time to see exactly what the agent read or wrote.',
    ].join('\n');

    await this.notion.appendToPage(parentId, content);
  }
}
