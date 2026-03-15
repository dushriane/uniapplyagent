/**
 * InterestAnalyzer — mines patterns from the Interests Log database
 * and surfaces "You've researched X most — consider Y programs" insights.
 *
 * Works entirely on in-memory data; no Notion API calls.
 */

import type { Interest, InterestPattern } from '../types';

// ── Field → suggested programs mapping ───────────────────────────────────────

const FIELD_TO_PROGRAMS: Record<string, string[]> = {
  'psychology': ['Psychology', 'Cognitive Science', 'Neuroscience', 'Behavioral Science'],
  'biology': ['Biology', 'Biochemistry', 'Neuroscience', 'Pre-Med', 'Environmental Science'],
  'computer science': ['Computer Science', 'Data Science', 'AI/ML', 'Software Engineering', 'Cognitive Science'],
  'data science': ['Data Science', 'Statistics', 'Computer Science', 'Quantitative Economics'],
  'environment': ['Environmental Studies', 'Sustainability', 'Earth Science', 'Environmental Policy'],
  'sustainability': ['Sustainability Studies', 'Environmental Science', 'Urban Planning', 'Environmental Policy'],
  'politics': ['Political Science', 'Public Policy', 'International Relations', 'Law'],
  'economics': ['Economics', 'Quantitative Economics', 'Finance', 'Public Policy'],
  'writing': ['English', 'Creative Writing', 'Journalism', 'Communications'],
  'art': ['Studio Art', 'Art History', 'Design', 'Architecture', 'Film'],
  'design': ['Graphic Design', 'UX Design', 'Architecture', 'Industrial Design'],
  'music': ['Music', 'Music Theory', 'Ethnomusicology', 'Music Technology'],
  'social justice': ['Sociology', 'Ethnic Studies', 'Public Policy', 'Social Work', 'Human Rights'],
  'anthropology': ['Anthropology', 'Archaeology', 'Cultural Studies', 'Sociology'],
  'history': ['History', 'Political Science', 'Cultural Anthropology', 'Museum Studies'],
  'philosophy': ['Philosophy', 'Ethics', 'Cognitive Science', 'Religious Studies', 'Law'],
  'mathematics': ['Mathematics', 'Statistics', 'Physics', 'Computer Science', 'Actuarial Science'],
  'physics': ['Physics', 'Astrophysics', 'Engineering', 'Mathematics'],
  'chemistry': ['Chemistry', 'Biochemistry', 'Chemical Engineering', 'Pharmacology'],
  'engineering': ['Mechanical Engineering', 'Electrical Engineering', 'Civil Engineering', 'Bioengineering'],
  'business': ['Business Administration', 'Entrepreneurship', 'Marketing', 'Finance', 'Management'],
  'entrepreneurship': ['Entrepreneurship', 'Business', 'Innovation Studies', 'Design Thinking'],
  'health': ['Public Health', 'Health Sciences', 'Pre-Med', 'Nursing', 'Health Policy'],
  'education': ['Education', 'Child Development', 'Educational Psychology', 'Curriculum Studies'],
  'communications': ['Communications', 'Journalism', 'Media Studies', 'Public Relations'],
  'film': ['Film Studies', 'Cinema Production', 'Media Studies', 'Digital Media'],
  'international': ['International Relations', 'Global Studies', 'Foreign Languages', 'Comparative Politics'],
  'language': ['Linguistics', 'Foreign Languages', 'Translation Studies', 'Comparative Literature'],
  'literature': ['English Literature', 'Comparative Literature', 'Creative Writing', 'Languages'],
  'sociology': ['Sociology', 'Social Work', 'Public Policy', 'Urban Studies'],
  'neuroscience': ['Neuroscience', 'Cognitive Science', 'Psychology', 'Biology'],
  'behavioral': ['Behavioral Science', 'Psychology', 'Behavioral Economics', 'Cognitive Science'],
};

// ── Relatedness graph (bidirectional) ─────────────────────────────────────────

const RELATED_FIELDS: Record<string, string[]> = {
  'psychology': ['neuroscience', 'behavioral', 'sociology', 'cognitive science'],
  'computer science': ['data science', 'mathematics', 'engineering', 'cognitive science'],
  'environment': ['sustainability', 'biology', 'politics', 'economics'],
  'sustainability': ['environment', 'social justice', 'politics'],
  'economics': ['business', 'politics', 'mathematics', 'data science'],
  'biology': ['chemistry', 'health', 'neuroscience', 'environment'],
  'social justice': ['sociology', 'politics', 'anthropology', 'education'],
  'design': ['art', 'entrepreneurship', 'engineering', 'film'],
  'neuroscience': ['psychology', 'biology', 'cognitive science'],
  'behavioral': ['psychology', 'economics', 'sociology'],
};

// ── InterestAnalyzer class ────────────────────────────────────────────────────

export class InterestAnalyzer {
  /**
   * Analyse a list of interests and return the top patterns, sorted by combined
   * frequency × strength score.
   */
  analyze(interests: Interest[], topN = 5): InterestPattern[] {
    if (!interests.length) return [];

    // Normalise field names to lowercase
    const normalised = interests.map((i) => ({
      ...i,
      field: i.field?.toLowerCase().trim() ?? 'general',
    }));

    // Group by field
    const groups = new Map<string, Interest[]>();
    for (const interest of normalised) {
      const key = this.canonicalise(interest.field ?? 'general');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(interest);
    }

    // Build patterns
    const patterns: InterestPattern[] = [];
    for (const [field, items] of groups.entries()) {
      const avgStrength =
        items.reduce((sum, i) => sum + (i.strength ?? 3), 0) / items.length;

      const relatedFields = (RELATED_FIELDS[field] ?? []).slice(0, 4);
      const suggestedPrograms = (FIELD_TO_PROGRAMS[field] ?? []).slice(0, 5);

      const insight = this.generateInsight(field, items.length, avgStrength, suggestedPrograms);

      patterns.push({
        field: this.displayName(field),
        count: items.length,
        avgStrength: Math.round(avgStrength * 10) / 10,
        relatedFields: relatedFields.map((f) => this.displayName(f)),
        suggestedPrograms,
        insight,
      });
    }

    // Sort by weighted score: count * avgStrength
    return patterns
      .sort((a, b) => b.count * b.avgStrength - a.count * a.avgStrength)
      .slice(0, topN);
  }

  /**
   * Check for multi-field intersections (e.g., psych + sustainability → behavioural science).
   */
  detectCombinedInsights(patterns: InterestPattern[]): string[] {
    const insights: string[] = [];
    const fields = patterns.map((p) => p.field.toLowerCase());

    if (fields.includes('psychology') && fields.includes('environment')) {
      insights.push('🔀 Psychology + Environment → consider Conservation Psychology or Environmental Behavior');
    }
    if (fields.includes('computer science') && fields.includes('biology')) {
      insights.push('🔀 CS + Biology → consider Bioinformatics or Computational Biology');
    }
    if (fields.includes('economics') && fields.includes('social justice')) {
      insights.push('🔀 Economics + Social Justice → consider Development Economics or Public Policy');
    }
    if (fields.includes('design') && fields.includes('health')) {
      insights.push('🔀 Design + Health → consider Healthcare UX or Medical Product Design');
    }
    if (fields.includes('computer science') && fields.includes('education')) {
      insights.push('🔀 CS + Education → consider Educational Technology or Learning Sciences');
    }
    if (fields.includes('art') && fields.includes('politics')) {
      insights.push('🔀 Art + Politics → consider Arts Administration or Cultural Policy');
    }
    if (fields.includes('mathematics') && fields.includes('economics')) {
      insights.push('🔀 Math + Economics → consider Quantitative Finance or Econometrics');
    }

    return insights;
  }

  /** Format patterns as a readable digest block. */
  formatDigest(patterns: InterestPattern[]): string {
    if (!patterns.length) return 'No interests logged yet. Use `uniapply interest add` to start exploring.';

    const lines: string[] = ['📊 Your Top Interest Areas:'];
    patterns.forEach((p, i) => {
      lines.push(`\n  ${i + 1}. ${p.field}  (${p.count} entries, avg strength ${p.avgStrength}/5)`);
      lines.push(`     💡 ${p.insight}`);
      if (p.suggestedPrograms.length) {
        lines.push(`     📚 Programs to explore: ${p.suggestedPrograms.join(', ')}`);
      }
      if (p.relatedFields.length) {
        lines.push(`     🔗 Related fields: ${p.relatedFields.join(', ')}`);
      }
    });

    const combined = this.detectCombinedInsights(patterns);
    if (combined.length) {
      lines.push('\n  🌐 Cross-field intersections:');
      combined.forEach((c) => lines.push(`  ${c}`));
    }

    return lines.join('\n');
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private canonicalise(field: string): string {
    const f = field.toLowerCase().trim();
    // Map synonyms to canonical keys
    const synonyms: Record<string, string> = {
      'psych': 'psychology', 'neuro': 'neuroscience', 'cs': 'computer science',
      'comp sci': 'computer science', 'econ': 'economics', 'bio': 'biology',
      'chem': 'chemistry', 'env': 'environment', 'enviro': 'environment',
      'poli sci': 'politics', 'polisci': 'politics', 'math': 'mathematics',
      'stats': 'mathematics', 'stat': 'mathematics', 'socio': 'sociology',
      'anthro': 'anthropology', 'comms': 'communications', 'comm': 'communications',
      'lit': 'literature', 'eng': 'engineering', 'phil': 'philosophy',
    };
    return synonyms[f] ?? f;
  }

  private displayName(field: string): string {
    return field.charAt(0).toUpperCase() + field.slice(1);
  }

  private generateInsight(
    field: string,
    count: number,
    avgStrength: number,
    programs: string[],
  ): string {
    const frequency =
      count >= 5 ? 'frequently' : count >= 3 ? 'regularly' : 'occasionally';
    const intensity =
      avgStrength >= 4 ? 'strong passion' : avgStrength >= 3 ? 'genuine interest' : 'mild curiosity';
    const suggestion = programs.length ? programs[0] : 'this area';
    return `You ${frequency} explore this with ${intensity}. Consider dedicating a school search to ${suggestion}.`;
  }
}
