/**
 * FitScorer — computes a 0–100 "Fit Score for Undecided Students" for each university.
 *
 * Scoring rubric  (total 100 pts):
 *  ┌──────────────────────────────────┬────────┐
 *  │ Dimension                        │ Weight │
 *  ├──────────────────────────────────┼────────┤
 *  │ Undecided-Friendly flag          │   30   │
 *  │ Curriculum Flexibility           │   25   │
 *  │ Advising Strength                │   25   │
 *  │ No Early Declaration Required    │   20   │
 *  └──────────────────────────────────┴────────┘
 *
 * The result is written back to Notion via NotionManager.updateUniversity().
 */

import type { University, FitScoreBreakdown, StudentPreferences } from '../types';

export class FitScorer {
  /**
   * Compute the fit score breakdown for a single university.
   * Does NOT write to Notion; the caller decides whether to persist.
   * Optionally applies preference-aware adjustments (Phase 3+ optional fields).
   */
  score(university: University, prefs?: Partial<StudentPreferences>): FitScoreBreakdown {
    const { undecidedFriendly, curriculumFlexibility, advisingStrength, earlyDeclarationRequired } =
      university;

    // ── Undecided Friendly (0–30) ─────────────────────────────────────────
    const undecidedFriendlyPoints = undecidedFriendly === true ? 30 : 0;

    // ── Curriculum Flexibility (0–25) ─────────────────────────────────────
    const flexMap: Record<string, number> = { High: 25, Medium: 14, Low: 5 };
    const curriculumFlexibilityPoints =
      curriculumFlexibility ? (flexMap[curriculumFlexibility] ?? 0) : 0;

    // ── Advising Strength (0–25) ──────────────────────────────────────────
    const advisingMap: Record<string, number> = {
      Excellent: 25,
      Good: 18,
      Fair: 10,
      Poor: 0,
    };
    const advisingStrengthPoints =
      advisingStrength ? (advisingMap[advisingStrength] ?? 0) : 0;

    // ── No Early Declaration Required (0–20) ──────────────────────────────
    const noEarlyDeclarationPoints =
      earlyDeclarationRequired === false
        ? 20
        : earlyDeclarationRequired === true
        ? 0
        : 10; // unknown — partial credit

    const total = Math.min(
      100,
      undecidedFriendlyPoints +
        curriculumFlexibilityPoints +
        advisingStrengthPoints +
        noEarlyDeclarationPoints,
    );

    // ── Phase 3+: Optional preference-aware adjustments ──────────────────
    let adjustedTotal = total;
    const adjustments: string[] = [];

    if (prefs) {
      // Advising need level — boost schools with stronger advising if student needs it
      if (prefs.advisingNeedLevel === 'High' && advisingStrengthPoints >= 18) {
        adjustedTotal = Math.min(100, adjustedTotal + 5);
        adjustments.push('✨ Strong advising match for your needs');
      }

      // Test optional consideration — boost if student prefers it
      if (prefs.testOptional && !university.acceptanceRate) {
        // If university doesn't document acceptance rate, it might be more flexible
        adjustments.push('📝 Test-optional friendly');
      }

      // Campus setting and climate — informational (no points, just notes)
      if (prefs.campusSetting && university.size) {
        const sizeToSetting: Record<string, 'Urban' | 'Suburban' | 'Rural'> = {
          'Small (<5k)': 'Rural',
          'Medium (5k–15k)': 'Suburban',
          'Large (15k–30k)': 'Urban',
          'Very Large (30k+)': 'Urban',
        };
        if (sizeToSetting[university.size] === prefs.campusSetting) {
          adjustments.push(`🏙️  Matches your ${prefs.campusSetting} preference`);
        }
      }

      // Financial aid need — informational
      if (
        prefs.financialAidNeed &&
        prefs.financialAidNeed > 50 &&
        !university.acceptanceRate
      ) {
        adjustments.push('💰 May offer competitive financial aid');
      }
    }

    const finalTotal = adjustedTotal;

    // ── Qualitative label ─────────────────────────────────────────────────
    const label =
      finalTotal >= 80
        ? 'Excellent Fit'
        : finalTotal >= 60
        ? 'Good Fit'
        : finalTotal >= 40
        ? 'Fair Fit'
        : 'Poor Fit';

    // ── Strengths / Weaknesses ────────────────────────────────────────────
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (undecidedFriendlyPoints === 30) strengths.push('Explicitly undecided-friendly');
    else weaknesses.push('Not marked as undecided-friendly');

    if (curriculumFlexibilityPoints >= 20) strengths.push('High curriculum flexibility');
    else if (curriculumFlexibilityPoints <= 5) weaknesses.push('Low curriculum flexibility');

    if (advisingStrengthPoints >= 18) strengths.push('Strong advising programme');
    else if (advisingStrengthPoints <= 5) weaknesses.push('Weak or unknown advising');

    if (noEarlyDeclarationPoints === 20) strengths.push('No early major declaration required');
    else if (noEarlyDeclarationPoints === 0) weaknesses.push('Early major declaration required');

    if (university.openCurriculum) strengths.push('Open curriculum (no distribution requirements)');
    if (university.firstYearFlexibility) strengths.push('First-year exploration programme');

    // Add preference-based adjustments to strengths
    strengths.push(...adjustments);

    return {
      total: finalTotal,
      undecidedFriendlyPoints,
      curriculumFlexibilityPoints,
      advisingStrengthPoints,
      noEarlyDeclarationPoints,
      label,
      strengths,
      weaknesses,
    };
  }

  /**
   * Score and rank a list of universities; returns them sorted best-first.
   */
  rankAll(universities: University[]): Array<University & { scoreBreakdown: FitScoreBreakdown }> {
    return universities
      .map((u) => ({ ...u, fitScore: this.score(u).total, scoreBreakdown: this.score(u) }))
      .sort((a, b) => b.fitScore! - a.fitScore!);
  }

  /**
   * Pretty-print scorecard for CLI output.
   */
  formatBreakdown(b: FitScoreBreakdown, universityName: string): string {
    const bar = (pts: number, max: number) =>
      '█'.repeat(Math.round((pts / max) * 10)) + '░'.repeat(10 - Math.round((pts / max) * 10));

    const lines = [
      `\n  Fit Score: ${b.total}/100 — ${b.label}  (${universityName})`,
      `  ──────────────────────────────────────────────────`,
      `  Undecided Friendly     ${bar(b.undecidedFriendlyPoints, 30)}  ${b.undecidedFriendlyPoints}/30`,
      `  Curriculum Flexibility ${bar(b.curriculumFlexibilityPoints, 25)}  ${b.curriculumFlexibilityPoints}/25`,
      `  Advising Strength      ${bar(b.advisingStrengthPoints, 25)}  ${b.advisingStrengthPoints}/25`,
      `  No Early Declaration   ${bar(b.noEarlyDeclarationPoints, 20)}  ${b.noEarlyDeclarationPoints}/20`,
      `  ──────────────────────────────────────────────────`,
    ];

    if (b.strengths.length) {
      lines.push(`  ✅ Strengths:`);
      b.strengths.forEach((s) => lines.push(`      • ${s}`));
    }
    if (b.weaknesses.length) {
      lines.push(`  ⚠️  Weaknesses:`);
      b.weaknesses.forEach((w) => lines.push(`      • ${w}`));
    }

    return lines.join('\n');
  }
}
