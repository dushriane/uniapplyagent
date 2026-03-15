/**
 * DeadlineAgent — Epic 5
 *
 * Responsibilities:
 *  • Proactive daily/weekly deadline scans (inbox + Notion)
 *  • Flag urgent items and auto-prioritise tasks
 *  • Auto-update Notion status when confirmation emails are forwarded
 *  • Human-in-the-loop confirmation for big actions
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { differenceInDays, formatDistanceToNow } from 'date-fns';
import { NotionManager } from '../notion/manager';
import type { University, Task, DeadlineAlert } from '../types';
import { loadConfig } from '../config';

// Urgency thresholds in days
const CRITICAL_DAYS = 7;
const HIGH_DAYS = 14;
const MEDIUM_DAYS = 30;

export class DeadlineAgent {
  constructor(private readonly notion: NotionManager) {}

  // ── Full deadline scan ─────────────────────────────────────────────────────

  /**
   * Queries all universities and tasks, returns sorted deadline alerts.
   * Optionally prompts user to auto-create urgent tasks.
   */
  async scan(interactive = true): Promise<DeadlineAlert[]> {
    const spinner = ora('Scanning deadlines…').start();

    const [universities, tasks] = await Promise.all([
      this.notion.queryUniversities(),
      this.notion.queryTasks(),
    ]);

    const now = new Date();
    const alerts: DeadlineAlert[] = [];

    // ── University application deadlines ──────────────────────────────────
    for (const u of universities) {
      if (!['Exploratory', 'Researching', 'Applying'].includes(u.status)) continue;
      if (!u.applicationDeadline && !u.earlyDeadline) continue;

      const relevantDeadline = u.earlyDeadline ?? u.applicationDeadline!;
      const daysLeft = differenceInDays(relevantDeadline, now);
      if (daysLeft < 0) continue; // already passed

      const urgency = this.calcUrgency(daysLeft);
      alerts.push({
        university: u,
        daysUntilDeadline: daysLeft,
        urgency,
        message: `${u.name} — ${daysLeft}d left (${u.earlyDeadline ? 'Early Action' : 'Regular'})`,
      });
    }

    // ── Overdue tasks ─────────────────────────────────────────────────────
    const overdueTasks = tasks.filter((t): t is Task & { dueDate: Date } =>
      t.dueDate != null && t.dueDate < now && t.status !== 'Completed' && t.status !== 'Waived',
    );

    for (const t of overdueTasks) {
      const daysOverdue = Math.abs(differenceInDays(t.dueDate, now));
      alerts.push({
        university: { name: t.universityName ?? 'General', status: 'Applying' } as University,
        task: t,
        daysUntilDeadline: -daysOverdue,
        urgency: 'Critical',
        message: `⚠️ OVERDUE ${daysOverdue}d: [${t.universityName ?? 'General'}] ${t.title}`,
      });
    }

    // ── Tasks due soon ────────────────────────────────────────────────────
    const soonTasks = tasks.filter((t): t is Task & { dueDate: Date } =>
      t.dueDate != null &&
      t.dueDate >= now &&
      t.dueDate <= new Date(now.getTime() + HIGH_DAYS * 86400000) &&
      t.status !== 'Completed',
    );

    for (const t of soonTasks) {
      const daysLeft = differenceInDays(t.dueDate, now);
      alerts.push({
        university: { name: t.universityName ?? 'General', status: 'Applying' } as University,
        task: t,
        daysUntilDeadline: daysLeft,
        urgency: this.calcUrgency(daysLeft),
        message: `[${t.universityName ?? 'General'}] ${t.title} — ${daysLeft}d`,
      });
    }

    // Sort: critical first, then by days
    alerts.sort((a, b) => {
      const urgencyOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      const uDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      return uDiff !== 0 ? uDiff : a.daysUntilDeadline - b.daysUntilDeadline;
    });

    spinner.succeed(chalk.green(`Deadline scan complete. Found ${alerts.length} items.`));
    this.printAlerts(alerts);

    // ── Mark overdue tasks in Notion ──────────────────────────────────────
    const config = loadConfig();
    if (!config.readOnlyMode) {
      for (const t of overdueTasks) {
        if (t.notionId && t.status !== 'Overdue') {
          await this.notion.updateTask(t.notionId, { status: 'Overdue' });
        }
      }
    }

    // ── Interactive: offer to create calendar reminders / prioritise ───────
    if (interactive && alerts.filter((a) => a.urgency === 'Critical').length > 0) {
      await this.interactiveFollowUp(alerts.filter((a) => a.urgency === 'Critical'));
    }

    await this.notion.logActivity(
      `Deadline scan: ${alerts.length} items found`,
      'scanDeadlines',
      'Read',
      'All universities & tasks',
      'Completed',
      `Critical: ${alerts.filter((a) => a.urgency === 'Critical').length}, High: ${alerts.filter((a) => a.urgency === 'High').length}`,
    );

    return alerts;
  }

  // ── Update status from confirmation email ─────────────────────────────────

  /**
   * Called when user forwards a submission confirmation email.
   * Finds matching university and updates its status to "Submitted".
   * Requires human approval before write.
   */
  async processConfirmationEmail(
    universityName: string,
    newStatus: University['status'],
    interactive = true,
  ): Promise<boolean> {
    const universities = await this.notion.queryUniversities();
    const university = universities.find(
      (u) => u.name.toLowerCase().includes(universityName.toLowerCase()),
    );
    if (!university?.notionId) {
      console.log(chalk.red(`  Could not find "${universityName}" in your database.`));
      return false;
    }

    const action = `Update ${university.name} → "${newStatus}"`;

    // Human-in-the-loop confirmation
    if (interactive) {
      const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
        {
          type: 'confirm',
          name: 'confirmed',
          message: chalk.yellow(`\n  🤖 Agent wants to: ${action}\n  Approve?`),
          default: true,
        },
      ]);
      if (!confirmed) {
        console.log(chalk.gray('  Skipped — no changes made.'));
        await this.notion.logActivity(action, 'processConfirmationEmail', 'Write', university.name, 'Skipped (User)');
        return false;
      }
    }

    const config = loadConfig();
    if (config.readOnlyMode) {
      console.log(chalk.yellow(`[READ_ONLY] Would update ${university.name} → ${newStatus}`));
      return false;
    }

    await this.notion.updateUniversity(university.notionId, { status: newStatus });
    console.log(chalk.green(`  ✅ ${university.name} updated → ${newStatus}`));

    await this.notion.logActivity(action, 'processConfirmationEmail', 'Write', university.name, 'Completed');
    return true;
  }

  // ── Auto-prioritise tasks ──────────────────────────────────────────────────

  async reprioritiseTasks(): Promise<void> {
    const spinner = ora('Re-prioritising tasks based on deadlines…').start();
    const tasks = await this.notion.queryTasks();
    const now = new Date();
    let updated = 0;

    for (const task of tasks) {
      if (!task.dueDate || task.status === 'Completed') continue;
      const days = differenceInDays(task.dueDate, now);
      const newPriority: Task['priority'] =
        days <= 3 ? 'Critical' : days <= 7 ? 'High' : days <= 21 ? 'Medium' : 'Low';

      if (task.notionId && task.priority !== newPriority) {
        const config = loadConfig();
        if (!config.readOnlyMode) {
          await this.notion.updateTask(task.notionId, { priority: newPriority });
          updated++;
        }
      }
    }

    spinner.succeed(chalk.green(`Re-prioritised ${updated} tasks.`));
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private calcUrgency(daysLeft: number): DeadlineAlert['urgency'] {
    if (daysLeft <= CRITICAL_DAYS) return 'Critical';
    if (daysLeft <= HIGH_DAYS) return 'High';
    if (daysLeft <= MEDIUM_DAYS) return 'Medium';
    return 'Low';
  }

  private printAlerts(alerts: DeadlineAlert[]): void {
    if (!alerts.length) {
      console.log(chalk.green('\n  ✅ No urgent deadlines. Keep it up!\n'));
      return;
    }

    const colorFor = (u: DeadlineAlert['urgency']) =>
      u === 'Critical' ? chalk.red : u === 'High' ? chalk.yellow : u === 'Medium' ? chalk.cyan : chalk.gray;

    console.log(chalk.bold('\n  📅 DEADLINE ALERTS\n'));
    for (const alert of alerts) {
      const label = alert.daysUntilDeadline < 0
        ? `OVERDUE ${Math.abs(alert.daysUntilDeadline)}d ago`
        : formatDistanceToNow(new Date(Date.now() + alert.daysUntilDeadline * 86400000), { addSuffix: true });
      console.log(
        colorFor(alert.urgency)(
          `  [${alert.urgency.padEnd(8)}]  ${alert.message.padEnd(60)}  ${label}`,
        ),
      );
    }
    console.log();
  }

  private async interactiveFollowUp(criticals: DeadlineAlert[]): Promise<void> {
    console.log(chalk.red(`\n  ⚠️  You have ${criticals.length} CRITICAL deadline(s)!\n`));
    const { action } = await inquirer.prompt<{ action: string }>([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Mark highest-priority task as "In Progress"', value: 'inprogress' },
          { name: 'Run full re-prioritisation', value: 'reprioritise' },
          { name: 'Nothing — just warn me', value: 'nothing' },
        ],
      },
    ]);

    if (action === 'reprioritise') {
      await this.reprioritiseTasks();
    } else if (action === 'inprogress') {
      const top = criticals[0];
      if (top.task?.notionId) {
        await this.notion.updateTask(top.task.notionId, { status: 'In Progress' });
        console.log(chalk.green(`  ✅ "${top.task.title}" marked as In Progress.`));
      }
    }
  }
}
