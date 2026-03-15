/**
 * TrackingAgent — Epic 6
 *
 * Responsibilities:
 *  • Surface patterns in Interests database ("you've researched X most")
 *  • Post-submission: log portal logins, interview invites, decision emails
 *  • Generate thank-you / follow-up email drafts
 *  • Track application streaks (consecutive days of activity)
 */

import chalk from 'chalk';
import ora from 'ora';
import OpenAI from 'openai';
import { differenceInDays, format } from 'date-fns';
import { NotionManager } from '../notion/manager';
import { InterestAnalyzer } from '../scoring/InterestAnalyzer';
import type { University, Task, Interest } from '../types';
import { loadConfig } from '../config';
import * as fs from 'fs';
import * as path from 'path';

export class TrackingAgent {
  private analyzer = new InterestAnalyzer();
  private openai: OpenAI | null = null;

  constructor(private readonly notion: NotionManager) {
    const { openaiApiKey } = loadConfig();
    if (openaiApiKey) this.openai = new OpenAI({ apiKey: openaiApiKey });
  }

  // ── Interest pattern surfacing ─────────────────────────────────────────────

  async analyzeInterestPatterns(): Promise<void> {
    const spinner = ora('Analysing interest patterns…').start();
    const interests = await this.notion.queryInterests();
    spinner.succeed(chalk.green(`Analysed ${interests.length} interest entries.`));

    if (!interests.length) {
      console.log(chalk.yellow('\n  No interests logged yet. Add some with `uniapply interest add`.\n'));
      return;
    }

    const patterns = this.analyzer.analyze(interests, 6);
    const digest = this.analyzer.formatDigest(patterns);
    console.log(chalk.bold.cyan('\n🔍 Interest Pattern Analysis\n'));
    console.log(digest);

    // Combined insights
    const combined = this.analyzer.detectCombinedInsights(patterns);
    if (combined.length) {
      console.log(chalk.bold('\n🌐 Cross-Field Insights:'));
      combined.forEach((c) => console.log(chalk.cyan(`  ${c}`)));
    }

    await this.notion.logActivity(
      `Interest pattern analysis: ${patterns.length} patterns found`,
      'analyzeInterests',
      'AI Analysis',
      'Interests Log',
      'Completed',
    );
  }

  // ── Post-submission logging ────────────────────────────────────────────────

  /**
   * Log a post-submission event (interview invite, decision, visit offer) and
   * auto-update the university status in Notion.
   */
  async logPostSubmissionEvent(
    universityName: string,
    eventType: 'Interview Invite' | 'Decision Received' | 'Campus Visit Invite' | 'Waitlisted' | 'Scholarship Offer',
    newStatus?: University['status'],
    details?: string,
  ): Promise<void> {
    const spinner = ora(`Logging ${eventType} for ${universityName}…`).start();

    // Create a task entry to track the event
    await this.notion.createTask({
      title: `[${eventType}] ${universityName}`,
      universityName,
      type: eventType.includes('Interview') ? 'Interview' : 'Decision',
      status: 'Not Started',
      priority: 'High',
      notes: details ?? `Auto-logged: ${eventType}`,
    });

    // Update university status if provided
    if (newStatus) {
      const universities = await this.notion.queryUniversities();
      const u = universities.find((uni) =>
        uni.name.toLowerCase().includes(universityName.toLowerCase()),
      );
      if (u?.notionId) {
        await this.notion.updateUniversity(u.notionId, { status: newStatus });
      }
    }

    spinner.succeed(chalk.green(`${eventType} logged for ${universityName}.`));

    // Offer to draft a response email
    if (eventType === 'Interview Invite' || eventType === 'Decision Received') {
      const draft = await this.draftResponseEmail(universityName, eventType, details);
      console.log(chalk.bold('\n  ✉️  Suggested Email Draft:\n'));
      console.log(chalk.gray('  ' + draft.split('\n').join('\n  ')));
      console.log();
    }
  }

  // ── Email draft generation ─────────────────────────────────────────────────

  async draftResponseEmail(
    universityName: string,
    eventType: string,
    context?: string,
  ): Promise<string> {
    if (this.openai) {
      try {
        const resp = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are a college application assistant. Write professional, warm, concise email drafts for students. Keep replies under 150 words.',
            },
            {
              role: 'user',
              content: `Draft a ${eventType.toLowerCase()} response email to ${universityName}.${context ? ` Context: ${context}` : ''}`,
            },
          ],
          max_tokens: 300,
        });
        return resp.choices[0].message.content ?? this.ruleBasedDraft(universityName, eventType);
      } catch {
        return this.ruleBasedDraft(universityName, eventType);
      }
    }
    return this.ruleBasedDraft(universityName, eventType);
  }

  // ── Activity streak tracker ────────────────────────────────────────────────

  /**
   * Compute how many consecutive days the student has been active in Notion.
   * Uses the Activity Log database timestamps.
   */
  async calculateStreak(): Promise<number> {
    // Simplified: count unique days in activity log for the last 30 days
    // (Full implementation would query the activity log and diff dates)
    return 1; // placeholder — real query requires iterating activity log dates
  }

  // ── Portal login tracker ───────────────────────────────────────────────────

  async logPortalLogin(
    universityName: string,
    portalUrl: string,
    notes?: string,
  ): Promise<void> {
    const universities = await this.notion.queryUniversities();
    const u = universities.find((uni) =>
      uni.name.toLowerCase().includes(universityName.toLowerCase()),
    );

    if (u?.notionId) {
      await this.notion.updateUniversity(u.notionId, { portalUrl, notes: notes ?? u.notes });
    }

    await this.notion.createTask({
      title: `Check portal: ${universityName}`,
      universityName,
      type: 'Application',
      status: 'Not Started',
      priority: 'Medium',
      notes: `Portal: ${portalUrl}${notes ? '\n' + notes : ''}`,
    });

    console.log(chalk.green(`  ✅ Portal logged for ${universityName}: ${portalUrl}`));
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private ruleBasedDraft(universityName: string, eventType: string): string {
    if (eventType.includes('Interview')) {
      return [
        `Dear ${universityName} Admissions Team,`,
        '',
        `Thank you for the interview invitation! I am very excited about the opportunity to speak with you further about my application.`,
        '',
        `I am available at your convenience and look forward to learning more about ${universityName}.`,
        '',
        'Warm regards,',
        '[Your Name]',
      ].join('\n');
    }
    return [
      `Dear ${universityName} Admissions Office,`,
      '',
      `Thank you for your decision regarding my application. I appreciate the time and consideration given to my materials.`,
      '',
      `Please let me know if there is any additional information needed.`,
      '',
      'Sincerely,',
      '[Your Name]',
    ].join('\n');
  }
}
