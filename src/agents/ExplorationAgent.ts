/**
 * ExplorationAgent — Epic 2 (Core for undecided students)
 *
 * Responsibilities:
 *  • Clip university/program webpages into Notion (URL → structured entry)
 *  • Convert forwarded articles / videos / quiz results into Interest Log entries
 *  • Generate weekly "Exploration Digest" Notion pages + CLI summaries
 *  • Display Fit Score for Undecided on new university entries
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import chalk from 'chalk';
import ora from 'ora';
import { format, startOfWeek } from 'date-fns';
import { NotionManager } from '../notion/manager';
import { FitScorer } from '../scoring/FitScorer';
import { InterestAnalyzer } from '../scoring/InterestAnalyzer';
import type { University, Interest, WeeklyDigest } from '../types';
import { loadConfig } from '../config';

export class ExplorationAgent {
  private scorer = new FitScorer();
  private analyzer = new InterestAnalyzer();

  constructor(private readonly notion: NotionManager) {}

  // ── Clip a URL ─────────────────────────────────────────────────────────────

  /**
   * Scrape a university webpage and create a new entry in the Universities DB.
   * Sets status to "Exploratory" and computes Fit Score immediately.
   */
  async clipUrl(rawUrl: string): Promise<University> {
    const spinner = ora(`Clipping ${rawUrl}…`).start();

    // ── Fetch & parse page ─────────────────────────────────────────────────
    let name = 'Unknown University';
    let location = '';
    let description = '';
    let fetchedUrl = rawUrl;

    try {
      const response = await axios.get(rawUrl, {
        timeout: 10_000,
        headers: { 'User-Agent': 'UniApply-Agent/1.0 (educational research tool)' },
        maxRedirects: 5,
      });
      const $ = cheerio.load(response.data as string);

      // Try multiple selectors for university name
      name =
        $('meta[property="og:site_name"]').attr('content') ||
        $('h1.site-title').first().text().trim() ||
        $('title').text().split(/[-|]/)[0].trim() ||
        'Unknown University';

      // Location
      location =
        $('meta[name="geo.placename"]').attr('content') ||
        $('[class*="location"]').first().text().trim() ||
        $('[class*="address"]').first().text().trim() ||
        '';

      // Description
      description =
        $('meta[property="og:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') ||
        $('p').first().text().trim().slice(0, 500) ||
        '';

      fetchedUrl = response.request?.res?.responseUrl ?? rawUrl;
      spinner.succeed(chalk.green(`Fetched page: ${name}`));
    } catch {
      spinner.warn(chalk.yellow(`Could not fetch page; creating entry with URL only.`));
    }

    // ── Detect undecided-friendly signals ─────────────────────────────────
    const combined = (name + description).toLowerCase();
    const undecidedFriendly =
      combined.includes('undecided') ||
      combined.includes('open curriculum') ||
      combined.includes('exploratory') ||
      combined.includes('first-year flexibility') ||
      combined.includes('liberal arts');

    const openCurriculum =
      combined.includes('open curriculum') || combined.includes('no distribution requirements');

    const earlyDeclarationRequired =
      combined.includes('declare a major') ||
      combined.includes('declare your major') ||
      combined.includes('declared by the end');

    const university: Omit<University, 'notionId'> = {
      name: name.slice(0, 200),
      url: fetchedUrl,
      location: location.slice(0, 200),
      status: 'Exploratory',
      notes: description.slice(0, 500),
      tags: ['Clipped'],
      undecidedFriendly,
      openCurriculum,
      earlyDeclarationRequired,
    };

    // ── Compute Fit Score ──────────────────────────────────────────────────
    const scoreBreakdown = this.scorer.score(university as University);
    (university as University).fitScore = scoreBreakdown.total;

    // ── Save to Notion ─────────────────────────────────────────────────────
    const config = loadConfig();
    if (!config.readOnlyMode) {
      const spinner2 = ora('Saving to Notion…').start();
      try {
        const id = await this.notion.createUniversity(university);
        (university as University).notionId = id;
        spinner2.succeed(chalk.green(`Saved: ${university.name} (Fit Score: ${scoreBreakdown.total}/100 — ${scoreBreakdown.label})`));
      } catch (err: unknown) {
        spinner2.fail(chalk.red('Failed to save to Notion: ' + (err as Error).message));
      }
    } else {
      console.log(chalk.yellow('[READ_ONLY] Would create university entry:'), university.name);
    }

    // ── Display score breakdown ────────────────────────────────────────────
    console.log(this.scorer.formatBreakdown(scoreBreakdown, university.name));

    return university as University;
  }

  // ── Log an interest entry ──────────────────────────────────────────────────

  async logInterest(
    title: string,
    field: string,
    source: Interest['source'],
    strength: 1 | 2 | 3 | 4 | 5 = 3,
    notes?: string,
    sourceUrl?: string,
  ): Promise<void> {
    const config = loadConfig();
    const interest: Omit<Interest, 'notionId'> = {
      title,
      type: 'Field',
      source,
      field,
      dateAdded: new Date(),
      strength,
      notes,
      url: sourceUrl,
      tags: [source],
    };

    if (!config.readOnlyMode) {
      const spinner = ora(`Logging interest: ${title}…`).start();
      try {
        await this.notion.createInterest(interest);
        spinner.succeed(chalk.green(`Interest logged: ${title} (${field})`));
      } catch (err: unknown) {
        spinner.fail(chalk.red('Failed to log interest: ' + (err as Error).message));
      }
    } else {
      console.log(chalk.yellow('[READ_ONLY] Would log interest:'), title);
    }
  }

  // ── Weekly Exploration Digest ──────────────────────────────────────────────

  async generateWeeklyDigest(): Promise<WeeklyDigest> {
    const spinner = ora('Generating Exploration Digest…').start();

    try {
      const [universities, interests, tasks] = await Promise.all([
        this.notion.queryUniversities(),
        this.notion.queryInterests(),
        this.notion.queryTasks(),
      ]);

      const weekStart = startOfWeek(new Date());
      const thisWeekInterests = interests.filter(
        (i) => i.dateAdded >= weekStart,
      );

      const thisWeekUniversities = universities.filter(
        (u) => u.status === 'Exploratory',
      );

      const completedTasks = tasks.filter((t) => t.status === 'Completed');
      const pendingTasks = tasks.filter(
        (t) => t.status === 'Not Started' || t.status === 'In Progress',
      );

      // Upcoming deadlines
      const now = new Date();
      const upcomingDeadlines = universities
        .filter(
          (u) =>
            u.applicationDeadline &&
            u.applicationDeadline > now &&
            ['Exploratory', 'Researching', 'Applying'].includes(u.status),
        )
        .map((u) => {
          const daysLeft = Math.ceil(
            (u.applicationDeadline!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          );
          return {
            university: u,
            daysUntilDeadline: daysLeft,
            urgency: daysLeft <= 7 ? ('Critical' as const) : daysLeft <= 14 ? ('High' as const) : daysLeft <= 30 ? ('Medium' as const) : ('Low' as const),
            message: `${u.name} — ${daysLeft} days left`,
          };
        })
        .sort((a, b) => a.daysUntilDeadline - b.daysUntilDeadline)
        .slice(0, 5);

      // Top undecided matches
      const topMatches = this.scorer.rankAll(universities).slice(0, 3).map((u) => u as University);

      // Interest patterns
      const patterns = this.analyzer.analyze(interests, 4);

      // Suggestions
      const suggestions = this.buildSuggestions(universities, tasks, interests);

      const digest: WeeklyDigest = {
        weekOf: weekStart,
        newUniversities: thisWeekUniversities.length,
        newInterests: thisWeekInterests.length,
        tasksCompleted: completedTasks.length,
        tasksPending: pendingTasks.length,
        upcomingDeadlines,
        topUndecidedMatches: topMatches,
        interestHighlights: patterns,
        suggestions,
      };

      // ── Write digest to Notion ──────────────────────────────────────────
      const config = loadConfig();
      if (!config.readOnlyMode && config.databaseIds.dashboardPageId) {
        const pageId = await this.writeDigestPage(digest, config.databaseIds.dashboardPageId);
        digest.notionPageId = pageId;
      }

      spinner.succeed(chalk.green('Exploration Digest ready!'));
      this.printDigest(digest);
      return digest;
    } catch (err: unknown) {
      spinner.fail(chalk.red('Failed to generate digest: ' + (err as Error).message));
      throw err;
    }
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  private buildSuggestions(
    universities: University[],
    tasks: import('../types').Task[],
    interests: Interest[],
  ): string[] {
    const suggestions: string[] = [];

    const undecidedSchools = universities.filter((u) => u.undecidedFriendly && u.status === 'Exploratory');
    if (undecidedSchools.length < 3) {
      suggestions.push('Add more undecided-friendly schools to reach your exploratory target.');
    }

    const overdueCount = tasks.filter((t) => t.status === 'Overdue').length;
    if (overdueCount > 0) {
      suggestions.push(`⚠️ You have ${overdueCount} overdue task(s). Run \`uniapply scan\` to review.`);
    }

    if (interests.length < 5) {
      suggestions.push('Log more interests (articles, quizzes, conversations) to unlock pattern insights.');
    }

    const patterns = this.analyzer.analyze(interests, 3);
    const combined = this.analyzer.detectCombinedInsights(patterns);
    combined.slice(0, 2).forEach((c) => suggestions.push(c));

    return suggestions;
  }

  private async writeDigestPage(digest: WeeklyDigest, parentId: string): Promise<string> {
    const weekLabel = format(digest.weekOf, 'MMM d, yyyy');
    const content = [
      `Week of ${weekLabel}`,
      '',
      `📥 New universities explored: ${digest.newUniversities}`,
      `💡 New interests logged: ${digest.newInterests}`,
      `✅ Tasks completed: ${digest.tasksCompleted}   ⏳ Pending: ${digest.tasksPending}`,
      '',
      '🎯 Top Undecided-Friendly Matches:',
      ...digest.topUndecidedMatches.map(
        (u, i) => `  ${i + 1}. ${u.name}  (Fit Score: ${u.fitScore ?? '?'}/100)`,
      ),
      '',
      '⏰ Upcoming Deadlines:',
      ...digest.upcomingDeadlines.map((d) => `  • ${d.message}`),
      '',
      '💡 Interest Highlights:',
      ...digest.interestHighlights.map(
        (p) => `  • ${p.field}: ${p.count} entries → ${p.suggestedPrograms[0] ?? p.field}`,
      ),
      '',
      '📋 Suggestions:',
      ...digest.suggestions.map((s) => `  • ${s}`),
    ].join('\n');

    return await this.notion.createPage(
      parentId,
      `🗂️ Exploration Digest — Week of ${weekLabel}`,
    ).then(async (id) => {
      await this.notion.appendToPage(id, content);
      return id;
    });
  }

  private printDigest(digest: WeeklyDigest): void {
    const weekLabel = format(digest.weekOf, 'MMM d, yyyy');
    console.log(chalk.bold.cyan(`\n📋 Exploration Digest — Week of ${weekLabel}\n`));
    console.log(`  New universities: ${chalk.yellow(digest.newUniversities)}   New interests: ${chalk.yellow(digest.newInterests)}`);
    console.log(`  Tasks completed:  ${chalk.green(digest.tasksCompleted)}   Pending: ${chalk.gray(digest.tasksPending)}`);

    if (digest.upcomingDeadlines.length) {
      console.log(chalk.bold('\n  ⏰ Upcoming Deadlines:'));
      digest.upcomingDeadlines.forEach((d) => {
        const color = d.urgency === 'Critical' ? chalk.red : d.urgency === 'High' ? chalk.yellow : chalk.gray;
        console.log(color(`     • ${d.message}`));
      });
    }

    if (digest.topUndecidedMatches.length) {
      console.log(chalk.bold('\n  🎯 Top Undecided-Friendly Matches:'));
      digest.topUndecidedMatches.forEach((u, i) => {
        console.log(chalk.green(`     ${i + 1}. ${u.name}  ${chalk.gray(`(Fit: ${u.fitScore ?? '?'}/100)`)}`));
      });
    }

    if (digest.suggestions.length) {
      console.log(chalk.bold('\n  💡 Suggestions:'));
      digest.suggestions.forEach((s) => console.log(chalk.cyan(`     • ${s}`)));
    }

    if (digest.notionPageId) {
      console.log(chalk.gray(`\n  📄 Digest page written to Notion: ${digest.notionPageId}`));
    }
    console.log();
  }
}
