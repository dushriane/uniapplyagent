/**
 * ResearchAgent — Epic 3
 *
 * Responsibilities:
 *  • Pull and append research details into existing Notion university entries
 *  • Compare pairs of schools (reads from Notion, writes comparison page)
 *  • Auto-log saved/forwarded emails as timeline entries for each university
 *  • AI-powered comparison narratives when OpenAI key is present
 */

import chalk from 'chalk';
import ora from 'ora';
import OpenAI from 'openai';
import { NotionManager } from '../notion/manager';
import { FitScorer } from '../scoring/FitScorer';
import type { University, ComparisonResult } from '../types';
import { loadConfig } from '../config';
import * as fs from 'fs';
import * as path from 'path';

export class ResearchAgent {
  private scorer = new FitScorer();
  private openai: OpenAI | null = null;

  constructor(private readonly notion: NotionManager) {
    const { openaiApiKey } = loadConfig();
    if (openaiApiKey) {
      this.openai = new OpenAI({ apiKey: openaiApiKey });
    }
  }

  // ── Compare two schools ─────────────────────────────────────────────────────

  async compareSchools(nameA: string, nameB: string): Promise<ComparisonResult> {
    const spinner = ora(`Comparing ${nameA} vs ${nameB}…`).start();

    const [allUniversities] = await Promise.all([this.notion.queryUniversities()]);

    const schoolA = allUniversities.find(
      (u) => u.name.toLowerCase().includes(nameA.toLowerCase()),
    );
    const schoolB = allUniversities.find(
      (u) => u.name.toLowerCase().includes(nameB.toLowerCase()),
    );

    if (!schoolA) {
      spinner.fail(chalk.red(`Cannot find "${nameA}" in your Universities database.`));
      throw new Error(`University "${nameA}" not found.`);
    }
    if (!schoolB) {
      spinner.fail(chalk.red(`Cannot find "${nameB}" in your Universities database.`));
      throw new Error(`University "${nameB}" not found.`);
    }

    const scoreA = this.scorer.score(schoolA);
    const scoreB = this.scorer.score(schoolB);

    // ── Build structured comparison table ───────────────────────────────────
    const criteria: ComparisonResult['criteria'] = {
      'Location': {
        [schoolA.name]: schoolA.location || 'Unknown',
        [schoolB.name]: schoolB.location || 'Unknown',
      },
      'Size': {
        [schoolA.name]: schoolA.size || 'Unknown',
        [schoolB.name]: schoolB.size || 'Unknown',
      },
      'Cost Range': {
        [schoolA.name]: schoolA.costRange || 'Unknown',
        [schoolB.name]: schoolB.costRange || 'Unknown',
      },
      'Fit Score': {
        [schoolA.name]: `${scoreA.total}/100 (${scoreA.label})`,
        [schoolB.name]: `${scoreB.total}/100 (${scoreB.label})`,
      },
      'Acceptance Rate': {
        [schoolA.name]: schoolA.acceptanceRate ? `${(schoolA.acceptanceRate * 100).toFixed(0)}%` : 'Unknown',
        [schoolB.name]: schoolB.acceptanceRate ? `${(schoolB.acceptanceRate * 100).toFixed(0)}%` : 'Unknown',
      },
      'Undecided Friendly': {
        [schoolA.name]: schoolA.undecidedFriendly ? '✅ Yes' : '❌ No',
        [schoolB.name]: schoolB.undecidedFriendly ? '✅ Yes' : '❌ No',
      },
      'Open Curriculum': {
        [schoolA.name]: schoolA.openCurriculum ? '✅ Yes' : '—',
        [schoolB.name]: schoolB.openCurriculum ? '✅ Yes' : '—',
      },
      'Curriculum Flexibility': {
        [schoolA.name]: schoolA.curriculumFlexibility || 'Unknown',
        [schoolB.name]: schoolB.curriculumFlexibility || 'Unknown',
      },
      'Advising Strength': {
        [schoolA.name]: schoolA.advisingStrength || 'Unknown',
        [schoolB.name]: schoolB.advisingStrength || 'Unknown',
      },
      'Early Declaration Required': {
        [schoolA.name]: schoolA.earlyDeclarationRequired ? '⚠️ Yes' : '✅ No',
        [schoolB.name]: schoolB.earlyDeclarationRequired ? '⚠️ Yes' : '✅ No',
      },
      'Priority': {
        [schoolA.name]: schoolA.priority || '—',
        [schoolB.name]: schoolB.priority || '—',
      },
      'Status': {
        [schoolA.name]: schoolA.status,
        [schoolB.name]: schoolB.status,
      },
    };

    const undecidedWinner =
      scoreA.total > scoreB.total ? schoolA.name : scoreB.total > scoreA.total ? schoolB.name : 'Tie';

    // ── Generate narrative via AI or rule-based ─────────────────────────────
    const narrative = await this.buildNarrative(schoolA, schoolB, scoreA, scoreB);

    spinner.succeed(chalk.green(`Comparison ready: ${schoolA.name} vs ${schoolB.name}`));

    const result: ComparisonResult = {
      universities: [schoolA, schoolB],
      criteria,
      undecidedRecommendation: undecidedWinner !== 'Tie' ? undecidedWinner : undefined,
      narrative,
    };

    // ── Print to CLI ─────────────────────────────────────────────────────────
    this.printComparison(result);

    // ── Write to Notion ──────────────────────────────────────────────────────
    const config = loadConfig();
    if (!config.readOnlyMode && config.databaseIds.dashboardPageId) {
      const pageId = await this.writeComparisonPage(result, config.databaseIds.dashboardPageId);
      result.notionPageId = pageId;
      console.log(chalk.gray(`\n  📄 Comparison page written to Notion: ${pageId}`));
    }

    await this.notion.logActivity(
      `Compared ${schoolA.name} vs ${schoolB.name}`,
      'compareSchools',
      'AI Analysis',
      `${schoolA.name}, ${schoolB.name}`,
      'Completed',
    );

    return result;
  }

  // ── Update university research notes ──────────────────────────────────────

  async appendResearchNotes(universityName: string, notes: string): Promise<void> {
    const spinner = ora(`Appending research notes to ${universityName}…`).start();
    const universities = await this.notion.queryUniversities();
    const university = universities.find(
      (u) => u.name.toLowerCase().includes(universityName.toLowerCase()),
    );
    if (!university?.notionId) {
      spinner.fail(chalk.red(`"${universityName}" not found in your database.`));
      return;
    }
    await this.notion.updateUniversity(university.notionId, {
      notes: [(university.notes || ''), notes].filter(Boolean).join('\n\n'),
    });
    spinner.succeed(chalk.green(`Notes appended to ${university.name}.`));
  }

  // ── Log a forwarded email as a timeline task ───────────────────────────────

  async logEmailAsTask(
    universityName: string,
    emailSubject: string,
    emailType: 'Campus Visit' | 'Application' | 'Financial Aid' | 'Interview' | 'Other',
    emailUrl?: string,
  ): Promise<void> {
    await this.notion.createTask({
      title: `[Email] ${emailSubject}`,
      universityName,
      type: emailType,
      status: 'Not Started',
      priority: 'Medium',
      notes: `Auto-logged from forwarded email.`,
      emailThreadLink: emailUrl,
    });
    console.log(chalk.green(`  ✅ Email logged as task for ${universityName}`));
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async buildNarrative(
    a: University,
    b: University,
    scoreA: ReturnType<FitScorer['score']>,
    scoreB: ReturnType<FitScorer['score']>,
  ): Promise<string> {
    if (this.openai) {
      try {
        const systemPrompt = this.loadPrompt('comparison.md');
        const userMsg = JSON.stringify({ schoolA: { ...a, fitScore: scoreA.total }, schoolB: { ...b, fitScore: scoreB.total } });
        const resp = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg },
          ],
          max_tokens: 500,
        });
        return resp.choices[0].message.content ?? this.ruleBasedNarrative(a, b, scoreA, scoreB);
      } catch {
        return this.ruleBasedNarrative(a, b, scoreA, scoreB);
      }
    }
    return this.ruleBasedNarrative(a, b, scoreA, scoreB);
  }

  private ruleBasedNarrative(
    a: University,
    b: University,
    scoreA: ReturnType<FitScorer['score']>,
    scoreB: ReturnType<FitScorer['score']>,
  ): string {
    const winner = scoreA.total >= scoreB.total ? a : b;
    const loser = winner === a ? b : a;
    const margin = Math.abs(scoreA.total - scoreB.total);
    const diff = margin < 10 ? 'similar undecided fit' : `a higher undecided fit (${margin}-point margin)`;
    return (
      `${winner.name} offers ${diff} for undecided students. ` +
      `${winner.name} has ${(scoreA.total >= scoreB.total ? scoreA : scoreB).strengths.slice(0, 2).join(' and ')}. ` +
      `${loser.name} may appeal if ${(scoreA.total < scoreB.total ? scoreA : scoreB).strengths[0] ?? 'other factors'} align with your goals.`
    );
  }

  private async writeComparisonPage(result: ComparisonResult, parentId: string): Promise<string> {
    const [a, b] = result.universities;
    const lines = [
      `Comparison: ${a.name} vs ${b.name}`,
      '',
      result.narrative,
      '',
      'CRITERIA COMPARISON:',
      ...Object.entries(result.criteria).map(
        ([crit, vals]) =>
          `  ${crit}: ${a.name} → ${vals[a.name]} | ${b.name} → ${vals[b.name]}`,
      ),
    ];
    if (result.undecidedRecommendation) {
      lines.push('', `🎓 Best for Undecided Students: ${result.undecidedRecommendation}`);
    }
    const pageId = await this.notion.createPage(parentId, `⚖️ ${a.name} vs ${b.name}`);
    await this.notion.appendToPage(pageId, lines.join('\n'));
    return pageId;
  }

  private printComparison(result: ComparisonResult): void {
    const [a, b] = result.universities;
    console.log(chalk.bold.cyan(`\n⚖️  ${a.name}  vs  ${b.name}\n`));
    Object.entries(result.criteria).forEach(([crit, vals]) => {
      console.log(
        `  ${chalk.white(crit.padEnd(26))}  ${chalk.yellow(String(vals[a.name]).padEnd(30))}  ${chalk.cyan(String(vals[b.name]))}`,
      );
    });
    if (result.undecidedRecommendation) {
      console.log(chalk.green(`\n  🎓 Best for undecided students: ${result.undecidedRecommendation}`));
    }
    console.log(chalk.gray(`\n  📝 ${result.narrative}\n`));
  }

  private loadPrompt(filename: string): string {
    const p = path.join(process.cwd(), 'prompts', filename);
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8');
    return 'You are an expert college admissions advisor. Compare these two universities for an undecided student and provide a concise recommendation.';
  }
}
