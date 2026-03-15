/**
 * PreparationAgent — Epic 4
 *
 * Responsibilities:
 *  • Generate per-school application checklists into Notion
 *  • AI-powered essay personalisation using school-specific Notion data
 *  • Track recommendation request email threads
 *  • Auto-link forwarded documents (transcripts, scores) to university rows
 */

import chalk from 'chalk';
import ora from 'ora';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { NotionManager } from '../notion/manager';
import type { University, Task, Essay, EssayPersonalization } from '../types';
import { loadConfig } from '../config';

// ── Standard checklist template ───────────────────────────────────────────────

const DEFAULT_CHECKLIST: Array<{ title: string; type: Task['type']; priority: Task['priority'] }> = [
  { title: 'Submit Common App / Coalition App main application', type: 'Application', priority: 'Critical' },
  { title: 'Submit application fee or fee waiver', type: 'Application', priority: 'High' },
  { title: 'Write Personal Statement', type: 'Essay', priority: 'Critical' },
  { title: 'Write school-specific supplemental essays', type: 'Essay', priority: 'Critical' },
  { title: 'Request teacher recommendation #1', type: 'Recommendation', priority: 'High' },
  { title: 'Request teacher recommendation #2', type: 'Recommendation', priority: 'High' },
  { title: 'Request counsellor recommendation', type: 'Recommendation', priority: 'High' },
  { title: 'Upload official transcripts', type: 'Document', priority: 'High' },
  { title: 'Upload test scores (SAT/ACT)', type: 'Document', priority: 'Medium' },
  { title: 'Complete financial aid / CSS Profile', type: 'Financial Aid', priority: 'High' },
  { title: 'Verify all sections complete on portal', type: 'Application', priority: 'Critical' },
  { title: 'Submit application', type: 'Application', priority: 'Critical' },
];

export class PreparationAgent {
  private openai: OpenAI | null = null;

  constructor(private readonly notion: NotionManager) {
    const { openaiApiKey } = loadConfig();
    if (openaiApiKey) this.openai = new OpenAI({ apiKey: openaiApiKey });
  }

  // ── Per-school checklist ───────────────────────────────────────────────────

  /**
   * Create a default task checklist for a university.
   * Also creates essay stub entries in the Essays DB.
   */
  async createChecklist(universityName: string, deadline?: Date): Promise<void> {
    const spinner = ora(`Creating checklist for ${universityName}…`).start();
    const config = loadConfig();

    if (config.readOnlyMode) {
      spinner.warn(chalk.yellow('[READ_ONLY] Would create checklist but skipping.'));
      return;
    }

    const tasks = DEFAULT_CHECKLIST.map((t): Omit<Task, 'notionId'> => ({
      ...t,
      universityName,
      status: 'Not Started',
      dueDate: deadline,
    }));

    let created = 0;
    for (const task of tasks) {
      try {
        await this.notion.createTask(task);
        created++;
      } catch {
        // continue on individual failures
      }
    }

    // Create essay stubs
    await this.notion.createEssay({
      title: `Personal Statement — ${universityName}`,
      universityName,
      type: 'Personal Statement',
      status: 'Not Started',
      wordLimit: 650,
      dueDate: deadline,
    });

    await this.notion.createEssay({
      title: `Supplemental Essay — ${universityName}`,
      universityName,
      type: 'Supplemental Essay',
      status: 'Not Started',
      dueDate: deadline,
    });

    spinner.succeed(
      chalk.green(
        `Checklist created for ${universityName}: ${created}/${DEFAULT_CHECKLIST.length} tasks + 2 essay stubs`,
      ),
    );

    await this.notion.logActivity(
      `Created checklist for ${universityName}`,
      'createChecklist',
      'Write',
      universityName,
      'Completed',
    );
  }

  // ── Essay personalisation ─────────────────────────────────────────────────

  /**
   * Personalise a draft essay for a specific school.
   * Reads the university's notes/tags from Notion to inject school-specific details.
   */
  async personalizeEssay(
    draftText: string,
    targetSchoolName: string,
  ): Promise<EssayPersonalization> {
    const spinner = ora(`Personalising essay for ${targetSchoolName}…`).start();

    // Fetch school data from Notion
    const universities = await this.notion.queryUniversities();
    const school = universities.find(
      (u) => u.name.toLowerCase().includes(targetSchoolName.toLowerCase()),
    );

    const essays = await this.notion.queryEssays(school?.name);

    const schoolContext = school
      ? [
          `University: ${school.name}`,
          `Location: ${school.location}`,
          `Size: ${school.size ?? 'Unknown'}`,
          `Undecided Friendly: ${school.undecidedFriendly}`,
          `Open Curriculum: ${school.openCurriculum}`,
          `Curriculum Flexibility: ${school.curriculumFlexibility ?? 'Unknown'}`,
          `Advising Strength: ${school.advisingStrength ?? 'Unknown'}`,
          `Tags: ${school.tags?.join(', ') ?? 'None'}`,
          `Notes: ${school.notes ?? 'None'}`,
          `Existing essay prompts: ${essays.map((e) => e.prompt ?? e.title).join(' | ')}`,
        ].join('\n')
      : `University: ${targetSchoolName} (not yet in your database)`;

    let personalizedText: string;
    let changes: string[] = [];
    let schoolSpecificPoints: string[] = [];

    if (this.openai) {
      try {
        const systemPrompt = this.loadPrompt('essay-personalizer.md');
        const resp = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `SCHOOL CONTEXT FROM NOTION:\n${schoolContext}\n\nSTUDENT'S DRAFT:\n${draftText}`,
            },
          ],
          max_tokens: 1500,
          response_format: { type: 'json_object' },
        });
        const parsed = JSON.parse(resp.choices[0].message.content ?? '{}');
        personalizedText = parsed.personalizedText ?? draftText;
        changes = parsed.changes ?? [];
        schoolSpecificPoints = parsed.schoolSpecificPoints ?? [];
      } catch {
        personalizedText = this.ruleBasedPersonalize(draftText, school);
        changes = ['Rule-based personalisation applied (OpenAI unavailable).'];
      }
    } else {
      personalizedText = this.ruleBasedPersonalize(draftText, school);
      changes = ['Rule-based personalisation applied (no OpenAI key configured).'];
      schoolSpecificPoints = this.extractSchoolPoints(school);
    }

    const result: EssayPersonalization = {
      originalText: draftText,
      personalizedText,
      changes,
      schoolSpecificPoints,
      suggestedAnecdoteThemes: school
        ? [
            school.undecidedFriendly ? 'Your desire to explore before declaring a major' : '',
            school.openCurriculum ? 'Excitement about designing your own curriculum' : '',
            school.advisingStrength === 'Excellent' ? 'Seeking mentorship and advising support' : '',
          ].filter(Boolean)
        : [],
      wordCount: personalizedText.split(/\s+/).length,
      targetSchool: school?.name ?? targetSchoolName,
    };

    // Save personalized version to Notion as a new essay
    const config = loadConfig();
    if (!config.readOnlyMode) {
      const essayId = await this.notion.createEssay({
        title: `Personalised Essay — ${result.targetSchool}`,
        universityName: result.targetSchool,
        type: 'Supplemental Essay',
        status: 'In Review',
        notes: 'AI-personalised by UniApply Agent',
      });
      result.notionPageId = essayId;
    }

    spinner.succeed(chalk.green(`Essay personalised for ${result.targetSchool} (${result.wordCount} words)`));
    this.printPersonalisationSummary(result);

    return result;
  }

  // ── Track recommendation requests ──────────────────────────────────────────

  async trackRecommendationRequest(
    universityName: string,
    recommenderName: string,
    dueDate?: Date,
    emailThreadUrl?: string,
  ): Promise<void> {
    await this.notion.createTask({
      title: `Rec letter from ${recommenderName} → ${universityName}`,
      universityName,
      type: 'Recommendation',
      status: 'In Progress',
      priority: 'High',
      dueDate,
      notes: `Recommender: ${recommenderName}. Track response and follow up if needed.`,
      emailThreadLink: emailThreadUrl,
    });
    console.log(
      chalk.green(
        `  ✅ Recommendation request tracked: ${recommenderName} → ${universityName}`,
      ),
    );
  }

  // ── Link document to university ────────────────────────────────────────────

  async linkDocument(
    universityName: string,
    documentTitle: string,
    documentType: Essay['type'],
    documentUrl?: string,
    status: Essay['status'] = 'Submitted',
  ): Promise<void> {
    await this.notion.createEssay({
      title: documentTitle,
      universityName,
      type: documentType,
      status,
      driveLink: documentUrl,
      notes: 'Auto-linked by UniApply Agent',
    });
    console.log(chalk.green(`  ✅ Document linked: ${documentTitle} → ${universityName}`));
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private ruleBasedPersonalize(draft: string, school?: University): string {
    if (!school) return draft;
    let personalised = draft;

    // Inject school name if it doesn't appear
    if (!draft.toLowerCase().includes(school.name.toLowerCase())) {
      personalised = personalised + `\n\n[Consider adding a specific reference to ${school.name}'s programs, community, or opportunities that align with your goals.]`;
    }

    // Open curriculum mention
    if (school.openCurriculum && !draft.toLowerCase().includes('curriculum')) {
      personalised = personalised + `\n\n[Consider mentioning ${school.name}'s open curriculum and how it aligns with your exploratory mindset.]`;
    }

    return personalised;
  }

  private extractSchoolPoints(school?: University): string[] {
    if (!school) return [];
    const points: string[] = [];
    if (school.undecidedFriendly) points.push('School explicitly supports undecided students');
    if (school.openCurriculum) points.push('Open curriculum — no set distribution requirements');
    if (school.advisingStrength === 'Excellent') points.push('Renowned academic advising programme');
    if (!school.earlyDeclarationRequired) points.push('No pressure to declare a major early');
    if (school.firstYearFlexibility) points.push('Dedicated first-year exploration programme');
    return points;
  }

  private printPersonalisationSummary(result: EssayPersonalization): void {
    console.log(chalk.bold('\n  📝 Personalisation Summary:'));
    console.log(`  Target School: ${chalk.cyan(result.targetSchool)}`);
    console.log(`  Word Count:    ${chalk.yellow(result.wordCount)}`);
    if (result.schoolSpecificPoints.length) {
      console.log('  School-specific angles to include:');
      result.schoolSpecificPoints.forEach((p) => console.log(chalk.green(`    • ${p}`)));
    }
    if (result.changes.length) {
      console.log('  Changes applied:');
      result.changes.forEach((c) => console.log(chalk.gray(`    • ${c}`)));
    }
    if (result.suggestedAnecdoteThemes.length) {
      console.log('  Suggested anecdote themes:');
      result.suggestedAnecdoteThemes.forEach((a) => console.log(chalk.cyan(`    • ${a}`)));
    }
    console.log();
  }

  private loadPrompt(filename: string): string {
    const p = path.join(process.cwd(), 'prompts', filename);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
  }
}
