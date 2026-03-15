/**
 * UniApplyAgent — Main Orchestrator
 *
 * Wires together all sub-agents and exposes a clean API used by the CLI.
 * Also handles scheduled cron jobs for daily scans and Sunday reports.
 */

import cron from 'node-cron';
import chalk from 'chalk';
import { NotionManager } from './notion/manager';
import { OnboardingAgent } from './agents/OnboardingAgent';
import { ExplorationAgent } from './agents/ExplorationAgent';
import { ResearchAgent } from './agents/ResearchAgent';
import { PreparationAgent } from './agents/PreparationAgent';
import { DeadlineAgent } from './agents/DeadlineAgent';
import { TrackingAgent } from './agents/TrackingAgent';
import { ReportingAgent } from './agents/ReportingAgent';
import { loadConfig } from './config';
import type {
  University,
  Interest,
  WeeklyDigest,
  HealthReport,
  ComparisonResult,
  EssayPersonalization,
  DeadlineAlert,
  StudentPreferences,
} from './types';

export class UniApplyAgent {
  public readonly notion: NotionManager;

  // Sub-agents (lazy-initialised)
  private _onboarding?: OnboardingAgent;
  private _exploration?: ExplorationAgent;
  private _research?: ResearchAgent;
  private _preparation?: PreparationAgent;
  private _deadline?: DeadlineAgent;
  private _tracking?: TrackingAgent;
  private _reporting?: ReportingAgent;

  constructor() {
    this.notion = new NotionManager();
  }

  // ── Sub-agent accessors ────────────────────────────────────────────────────

  get onboarding(): OnboardingAgent {
    return (this._onboarding ??= new OnboardingAgent(this.notion));
  }
  get exploration(): ExplorationAgent {
    return (this._exploration ??= new ExplorationAgent(this.notion));
  }
  get research(): ResearchAgent {
    return (this._research ??= new ResearchAgent(this.notion));
  }
  get preparation(): PreparationAgent {
    return (this._preparation ??= new PreparationAgent(this.notion));
  }
  get deadline(): DeadlineAgent {
    return (this._deadline ??= new DeadlineAgent(this.notion));
  }
  get tracking(): TrackingAgent {
    return (this._tracking ??= new TrackingAgent(this.notion));
  }
  get reporting(): ReportingAgent {
    return (this._reporting ??= new ReportingAgent(this.notion));
  }

  // ── Epic 1: Onboarding ─────────────────────────────────────────────────────

  async setup(): Promise<void> {
    await this.onboarding.run();
  }

  // ── Epic 2: Exploration ────────────────────────────────────────────────────

  async clipUrl(url: string): Promise<University> {
    return this.exploration.clipUrl(url);
  }

  async logInterest(
    title: string,
    field: string,
    source: Interest['source'],
    strength: 1 | 2 | 3 | 4 | 5 = 3,
    notes?: string,
    url?: string,
  ): Promise<void> {
    return this.exploration.logInterest(title, field, source, strength, notes, url);
  }

  async generateDigest(): Promise<WeeklyDigest> {
    return this.exploration.generateWeeklyDigest();
  }

  // ── Epic 3: Research ───────────────────────────────────────────────────────

  async compareSchools(nameA: string, nameB: string): Promise<ComparisonResult> {
    return this.research.compareSchools(nameA, nameB);
  }

  async appendResearchNotes(universityName: string, notes: string): Promise<void> {
    return this.research.appendResearchNotes(universityName, notes);
  }

  async logEmailAsTask(
    universityName: string,
    subject: string,
    type: 'Campus Visit' | 'Application' | 'Financial Aid' | 'Interview' | 'Other',
    emailUrl?: string,
  ): Promise<void> {
    return this.research.logEmailAsTask(universityName, subject, type, emailUrl);
  }

  // ── Epic 4: Preparation ────────────────────────────────────────────────────

  async createChecklist(universityName: string, deadline?: Date): Promise<void> {
    return this.preparation.createChecklist(universityName, deadline);
  }

  async personalizeEssay(draftText: string, schoolName: string): Promise<EssayPersonalization> {
    return this.preparation.personalizeEssay(draftText, schoolName);
  }

  async trackRecommendation(
    universityName: string,
    recommender: string,
    dueDate?: Date,
    emailUrl?: string,
  ): Promise<void> {
    return this.preparation.trackRecommendationRequest(universityName, recommender, dueDate, emailUrl);
  }

  // ── Epic 5: Deadlines ──────────────────────────────────────────────────────

  async scanDeadlines(interactive = true): Promise<DeadlineAlert[]> {
    return this.deadline.scan(interactive);
  }

  async processConfirmation(
    universityName: string,
    newStatus: University['status'],
  ): Promise<boolean> {
    return this.deadline.processConfirmationEmail(universityName, newStatus, true);
  }

  // ── Epic 6: Tracking ───────────────────────────────────────────────────────

  async analyzeInterests(): Promise<void> {
    return this.tracking.analyzeInterestPatterns();
  }

  async logPostSubmission(
    universityName: string,
    eventType: 'Interview Invite' | 'Decision Received' | 'Campus Visit Invite' | 'Waitlisted' | 'Scholarship Offer',
    newStatus?: University['status'],
    details?: string,
  ): Promise<void> {
    return this.tracking.logPostSubmissionEvent(universityName, eventType, newStatus, details);
  }

  // ── Epic 7: Reporting & Maintenance ───────────────────────────────────────

  async generateHealthReport(): Promise<HealthReport> {
    return this.reporting.generateHealthReport();
  }

  async showStatus(): Promise<void> {
    return this.reporting.showStatusDashboard();
  }

  async archiveUniversity(universityName: string): Promise<void> {
    return this.reporting.archiveUniversity(universityName);
  }

  // ── Scheduled jobs ─────────────────────────────────────────────────────────

  /**
   * Start background cron jobs.
   * • Daily @ 08:00 — deadline scan (non-interactive)
   * • Sunday @ 09:00 — exploration digest + health report
   */
  startScheduler(): void {
    const config = loadConfig();
    if (!config.scheduleEnabled) {
      console.log(chalk.gray('Scheduler disabled. Set SCHEDULE_ENABLED=true to enable.'));
      return;
    }

    // Daily deadline scan
    cron.schedule('0 8 * * *', async () => {
      console.log(chalk.cyan('[Scheduler] Running daily deadline scan…'));
      try {
        await this.scanDeadlines(false); // non-interactive
      } catch (err: unknown) {
        console.error(chalk.red('[Scheduler] Deadline scan failed:'), (err as Error).message);
      }
    });

    // Sunday digest + health report
    cron.schedule('0 9 * * 0', async () => {
      console.log(chalk.cyan('[Scheduler] Running Sunday digest + health report…'));
      try {
        await this.generateDigest();
        await this.generateHealthReport();
      } catch (err: unknown) {
        console.error(chalk.red('[Scheduler] Report failed:'), (err as Error).message);
      }
    });

    console.log(chalk.green('✅ Scheduler started.'));
    console.log(chalk.gray('  • Daily deadline scan: 08:00'));
    console.log(chalk.gray('  • Sunday report: 09:00'));
  }
}
