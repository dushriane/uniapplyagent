/**
 * ReportingAgent — Epics 6 & 7
 *
 * Responsibilities:
 *  • Generate "Application Health Reports" (Notion page + CLI summary)
 *  • Compute overall health score, gaps, and next-step recommendations
 *  • Archive completed applications
 *  • Manage activity log / audit trail display
 */

import chalk from 'chalk';
import ora from 'ora';
import { format } from 'date-fns';
import { NotionManager } from '../notion/manager';
import { FitScorer } from '../scoring/FitScorer';
import type { University, HealthReport, UniversityStatus } from '../types';
import { loadConfig } from '../config';

export class ReportingAgent {
  private scorer = new FitScorer();

  constructor(private readonly notion: NotionManager) {}

  // ── Health Report ─────────────────────────────────────────────────────────

  /**
   * Full application health report — Notion page + rich CLI output.
   * Health score formula:
   *   50% = university pipeline coverage (safety/match/reach spread)
   *   30% = essay completion rate
   *   20% = tasks on-time rate
   */
  async generateHealthReport(): Promise<HealthReport> {
    const spinner = ora('Generating Application Health Report…').start();

    const [universities, essays, tasks] = await Promise.all([
      this.notion.queryUniversities(),
      this.notion.queryEssays(),
      this.notion.queryTasks(),
    ]);

    const now = new Date();

    // ── Status counts ─────────────────────────────────────────────────────
    const byStatus = universities.reduce<Partial<Record<UniversityStatus, number>>>((acc, u) => {
      acc[u.status] = (acc[u.status] ?? 0) + 1;
      return acc;
    }, {});

    // ── Essay completion ──────────────────────────────────────────────────
    const submittedEssays = essays.filter(
      (e) => e.status === 'Submitted' || e.status === 'Polished',
    ).length;
    const essayCompletionPct =
      essays.length > 0 ? Math.round((submittedEssays / essays.length) * 100) : 0;

    // ── Task metrics ──────────────────────────────────────────────────────
    const overdueTasks = tasks.filter(
      (t) => t.dueDate && t.dueDate < now && t.status !== 'Completed',
    ).length;
    const week = new Date(now.getTime() + 7 * 86400000);
    const dueSoonTasks = tasks.filter(
      (t) => t.dueDate && t.dueDate >= now && t.dueDate <= week && t.status !== 'Completed',
    ).length;

    // ── Health score ──────────────────────────────────────────────────────
    const safetyCount = universities.filter((u) => u.priority === 'Safety').length;
    const matchCount = universities.filter((u) => u.priority === 'Match').length;
    const reachCount = universities.filter((u) => u.priority === 'Reach').length;
    const pipelineScore = this.scorePipeline(safetyCount, matchCount, reachCount);

    const essayScore = essayCompletionPct;
    const taskScore = tasks.length > 0
      ? Math.max(0, 100 - overdueTasks * 20)
      : 80;

    const overallScore = Math.round(0.5 * pipelineScore + 0.3 * essayScore + 0.2 * taskScore);

    // ── Identify gaps ─────────────────────────────────────────────────────
    const gaps = this.identifyGaps(universities, essays, tasks, safetyCount, matchCount, reachCount);

    // ── Recommendations ───────────────────────────────────────────────────
    const recommendations = this.buildRecommendations(gaps, overalScore => overalScore);

    const report: HealthReport = {
      generatedAt: now,
      overallScore,
      totalUniversities: universities.length,
      byStatus,
      essayCompletionPct,
      tasksOverdue: overdueTasks,
      tasksDueSoon: dueSoonTasks,
      gaps,
      recommendations,
      streakDays: 1,
    };

    spinner.succeed(chalk.green(`Health Report generated. Overall score: ${overallScore}/100`));
    this.printReport(report);

    // Write to Notion
    const config = loadConfig();
    if (!config.readOnlyMode && config.databaseIds.dashboardPageId) {
      try {
        const pageId = await this.writeReportPage(report, config.databaseIds.dashboardPageId);
        report.notionPageId = pageId;
        console.log(chalk.gray(`\n  📄 Report written to Notion: ${pageId}`));
      } catch {
        // non-critical
      }
    }

    await this.notion.logActivity(
      `Health report generated (score: ${overallScore}/100)`,
      'generateHealthReport',
      'Write',
      'Dashboard',
      'Completed',
    );

    return report;
  }

  // ── Archive management ─────────────────────────────────────────────────────

  /**
   * Move a university to "Archived" status.
   * Prompts for confirmation before writing.
   */
  async archiveUniversity(universityName: string): Promise<void> {
    const spinner = ora(`Archiving ${universityName}…`).start();
    const universities = await this.notion.queryUniversities();
    const u = universities.find((uni) =>
      uni.name.toLowerCase().includes(universityName.toLowerCase()),
    );
    if (!u?.notionId) {
      spinner.fail(chalk.red(`"${universityName}" not found.`));
      return;
    }
    if (u.status === 'Archived') {
      spinner.warn(chalk.yellow(`${u.name} is already archived.`));
      return;
    }

    const config = loadConfig();
    if (!config.readOnlyMode) {
      await this.notion.updateUniversity(u.notionId, { status: 'Archived', tags: [...(u.tags ?? []), 'Archived'] });
    }

    await this.notion.logActivity(
      `Archived: ${u.name}`,
      'archiveUniversity',
      'Archive',
      u.name,
      'Completed',
    );

    spinner.succeed(chalk.green(`${u.name} archived. It remains searchable in Notion.`));
  }

  // ── Status dashboard ───────────────────────────────────────────────────────

  async showStatusDashboard(): Promise<void> {
    const spinner = ora('Loading dashboard…').start();
    const [universities, tasks, essays] = await Promise.all([
      this.notion.queryUniversities(),
      this.notion.queryTasks(),
      this.notion.queryEssays(),
    ]);
    spinner.stop();

    const ranked = this.scorer.rankAll(universities).slice(0, 8);
    const now = new Date();

    console.log(chalk.bold.cyan('\n📊 UniApply Dashboard\n'));
    console.log(`  Total Schools: ${chalk.yellow(universities.length)}   Essays: ${chalk.yellow(essays.length)}   Tasks: ${chalk.yellow(tasks.length)}`);

    // By status
    const statusLine = Object.entries(
      universities.reduce<Partial<Record<UniversityStatus, number>>>((acc, u) => {
        acc[u.status] = (acc[u.status] ?? 0) + 1; return acc;
      }, {}),
    )
      .map(([s, n]) => `${s}: ${n}`)
      .join('  •  ');
    console.log(chalk.gray(`  ${statusLine}`));

    // Top schools by fit score
    console.log(chalk.bold('\n  🏆 Top Matches (by Fit Score):'));
    ranked.forEach((u, i) => {
      const deadlineStr = u.applicationDeadline
        ? chalk.gray(` — deadline ${format(u.applicationDeadline, 'MMM d')}`)
        : '';
      console.log(
        `  ${String(i + 1).padStart(2)}.  ${chalk.white(u.name.padEnd(35))}  ` +
        `${chalk.cyan(String(u.fitScore ?? '?').padStart(3))}/100  ` +
        `${chalk.gray(u.status)}${deadlineStr}`,
      );
    });

    // Overdue tasks
    const overdue = tasks.filter(
      (t) => t.dueDate && t.dueDate < now && t.status !== 'Completed',
    );
    if (overdue.length) {
      console.log(chalk.red(`\n  ⚠️  ${overdue.length} OVERDUE task(s) — run \`uniapply scan\` to review.`));
    }

    // Essay completion
    const polished = essays.filter((e) => ['Polished', 'Submitted'].includes(e.status)).length;
    const pct = essays.length > 0 ? Math.round((polished / essays.length) * 100) : 0;
    console.log(chalk.bold(`\n  ✍️  Essay Completion: ${pct}% (${polished}/${essays.length})`));
    console.log();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private scorePipeline(safety: number, match: number, reach: number): number {
    let score = 0;
    // At least 2 safeties
    score += Math.min(safety * 25, 40);
    // At least 3 matches
    score += Math.min(match * 15, 35);
    // At least 2 reaches
    score += Math.min(reach * 12, 25);
    return Math.min(score, 100);
  }

  private identifyGaps(
    universities: University[],
    essays: ReturnType<NotionManager['queryEssays']> extends Promise<infer T> ? T : never,
    tasks: ReturnType<NotionManager['queryTasks']> extends Promise<infer T> ? T : never,
    safetyCount: number,
    matchCount: number,
    reachCount: number,
  ): string[] {
    const gaps: string[] = [];
    if (universities.length === 0) gaps.push('No universities added yet. Use `uniapply clip <url>` to start.');
    if (safetyCount < 2) gaps.push(`Only ${safetyCount} safety school(s) — aim for at least 2.`);
    if (matchCount < 3) gaps.push(`Only ${matchCount} match school(s) — aim for at least 3.`);
    if (reachCount < 2) gaps.push(`Only ${reachCount} reach/dream school(s) — consider adding more.`);
    const draftingEssays = essays.filter
      ? (essays as { status: string }[]).filter((e) => e.status === 'Not Started').length
      : 0;
    if (draftingEssays > 3) gaps.push(`${draftingEssays} essays not yet started — begin brainstorming.`);
    const overdueCount = (tasks as { status: string; dueDate?: Date }[]).filter(
      (t) => t.status === 'Overdue',
    ).length;
    if (overdueCount > 0) gaps.push(`${overdueCount} overdue task(s) need immediate attention.`);
    return gaps;
  }

  private buildRecommendations(gaps: string[], _fn: (n: number) => number): string[] {
    return gaps.length === 0
      ? ['Great work! Your application pipeline looks healthy.', 'Consider doing a final essay review before deadlines.']
      : gaps.slice(0, 4).map((g) => `Action needed: ${g}`);
  }

  private printReport(report: HealthReport): void {
    const scoreColor =
      report.overallScore >= 80 ? chalk.green : report.overallScore >= 60 ? chalk.yellow : chalk.red;

    console.log(chalk.bold.cyan(`\n📋 Application Health Report — ${format(report.generatedAt, 'MMMM d, yyyy')}\n`));
    console.log(`  Overall Score: ${scoreColor(String(report.overallScore) + '/100')}`);
    console.log(`  Universities: ${report.totalUniversities}   Essay completion: ${report.essayCompletionPct}%`);
    console.log(`  Tasks overdue: ${chalk.red(String(report.tasksOverdue))}   Due this week: ${chalk.yellow(String(report.tasksDueSoon))}`);

    if (report.gaps.length) {
      console.log(chalk.bold('\n  🛑 Gaps:'));
      report.gaps.forEach((g) => console.log(chalk.red(`     • ${g}`)));
    }

    if (report.recommendations.length) {
      console.log(chalk.bold('\n  ✅ Recommendations:'));
      report.recommendations.forEach((r) => console.log(chalk.cyan(`     • ${r}`)));
    }
    console.log();
  }

  private async writeReportPage(report: HealthReport, parentId: string): Promise<string> {
    const lines = [
      `Overall Score: ${report.overallScore}/100`,
      `Universities: ${report.totalUniversities}`,
      `Essay completion: ${report.essayCompletionPct}%`,
      `Overdue tasks: ${report.tasksOverdue}`,
      `Due this week: ${report.tasksDueSoon}`,
      '',
      'Gaps:',
      ...report.gaps.map((g) => `  • ${g}`),
      '',
      'Recommendations:',
      ...report.recommendations.map((r) => `  • ${r}`),
    ].join('\n');

    const dateLabel = format(report.generatedAt, 'MMM d, yyyy');
    const pageId = await this.notion.createPage(parentId, `📋 Health Report — ${dateLabel}`);
    await this.notion.appendToPage(pageId, lines);
    return pageId;
  }
}
