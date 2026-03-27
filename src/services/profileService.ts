import type { StudentPreferences } from '../types';

export interface BaseProfileInput {
  locationRaw: string;
  maxTuition: number;
  sizeRaw: string[];
  undecidedFriendly: boolean;
  strongAdvising: boolean;
  gpa: number;
  satScore: number;
  targetApplicationCount: number;
}

export interface OptionalProfileInput {
  intendedMajors: string;
  testOptional: boolean;
  learningStyle: string;
  financialAidNeed: number;
  campusSetting: string;
  preferredClimate: string;
  advisingNeedLevel: string;
  accessibilityNeeds: string;
  communicationPreference: string;
}

export function mapProfileInputs(
  base: BaseProfileInput,
  optional: OptionalProfileInput,
): Partial<StudentPreferences> {
  const preferences: Partial<StudentPreferences> = {
    locationPreferences: base.locationRaw
      ? base.locationRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    maxTuition: base.maxTuition > 0 ? base.maxTuition : undefined,
    schoolSizePreference: base.sizeRaw.length
      ? (base.sizeRaw as unknown as StudentPreferences['schoolSizePreference'])
      : undefined,
    undecidedFriendly: base.undecidedFriendly,
    strongAdvising: base.strongAdvising,
    gpa: base.gpa > 0 ? base.gpa : undefined,
    satScore: base.satScore > 0 ? base.satScore : undefined,
    targetApplicationCount: base.targetApplicationCount,
  };

  if (optional.intendedMajors.trim()) {
    preferences.intendedMajors = optional.intendedMajors
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  preferences.testOptional = optional.testOptional;

  if (optional.campusSetting !== '(skip)') {
    preferences.campusSetting = optional.campusSetting as 'Urban' | 'Suburban' | 'Rural';
  }

  if (optional.learningStyle !== '(skip)') {
    preferences.learningStyle = optional.learningStyle;
  }

  if (optional.financialAidNeed > 0) {
    preferences.financialAidNeed = optional.financialAidNeed;
  }

  if (optional.preferredClimate.trim()) {
    preferences.preferredClimate = optional.preferredClimate;
  }

  if (optional.advisingNeedLevel !== '(skip)') {
    preferences.advisingNeedLevel = optional.advisingNeedLevel as 'Low' | 'Medium' | 'High';
  }

  if (optional.accessibilityNeeds.trim()) {
    preferences.accessibilityNeeds = optional.accessibilityNeeds;
  }

  if (optional.communicationPreference !== '(skip)') {
    preferences.communicationPreference = optional.communicationPreference as 'Email' | 'SMS' | 'Both';
  }

  return preferences;
}

export function buildSettingsMirrorContent(prefs: StudentPreferences): string {
  const lines = [
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
    '## Optional Profile Fields',
    `- Intended Majors: ${prefs.intendedMajors?.join(', ') || 'Not set'}`,
    `- Test Optional: ${prefs.testOptional ?? true}`,
    `- Campus Setting: ${prefs.campusSetting ?? 'Not set'}`,
    `- Learning Style: ${prefs.learningStyle ?? 'Not set'}`,
    `- Financial Aid Need (%): ${prefs.financialAidNeed ?? 'Not set'}`,
    `- Preferred Climate: ${prefs.preferredClimate ?? 'Not set'}`,
    `- Advising Need Level: ${prefs.advisingNeedLevel ?? 'Not set'}`,
    `- Accessibility Needs: ${prefs.accessibilityNeeds ?? 'Not set'}`,
    `- Communication Preference: ${prefs.communicationPreference ?? 'Not set'}`,
    '',
    '## Access & Audit',
    'All agent actions are logged in the 🔍 Activity Log database.',
    'Review it any time to see exactly what the agent read or wrote.',
  ];

  return lines.join('\n');
}
