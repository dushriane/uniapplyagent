import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSettingsMirrorContent, mapProfileInputs } from '../src/services/profileService';
import type { StudentPreferences } from '../src/types';

test('maps base and optional profile inputs into persisted preferences', () => {
  const result = mapProfileInputs(
    {
      locationRaw: 'Northeast, California,  ',
      maxTuition: 55000,
      sizeRaw: ['Small (<5k)', 'Medium (5k–15k)'],
      undecidedFriendly: true,
      strongAdvising: true,
      gpa: 3.8,
      satScore: 1490,
      targetApplicationCount: 10,
    },
    {
      intendedMajors: 'Computer Science, Economics',
      testOptional: false,
      learningStyle: 'Collaborative',
      financialAidNeed: 70,
      campusSetting: 'Urban',
      preferredClimate: 'Temperate',
      advisingNeedLevel: 'High',
      accessibilityNeeds: 'Wheelchair accessible',
      communicationPreference: 'Both',
    },
  );

  assert.deepEqual(result.locationPreferences, ['Northeast', 'California']);
  assert.equal(result.maxTuition, 55000);
  assert.equal(result.undecidedFriendly, true);
  assert.equal(result.strongAdvising, true);
  assert.equal(result.gpa, 3.8);
  assert.equal(result.satScore, 1490);
  assert.equal(result.targetApplicationCount, 10);
  assert.deepEqual(result.intendedMajors, ['Computer Science', 'Economics']);
  assert.equal(result.testOptional, false);
  assert.equal(result.learningStyle, 'Collaborative');
  assert.equal(result.financialAidNeed, 70);
  assert.equal(result.campusSetting, 'Urban');
  assert.equal(result.preferredClimate, 'Temperate');
  assert.equal(result.advisingNeedLevel, 'High');
  assert.equal(result.accessibilityNeeds, 'Wheelchair accessible');
  assert.equal(result.communicationPreference, 'Both');
});

test('skips optional profile fields when skip values are provided', () => {
  const result = mapProfileInputs(
    {
      locationRaw: '',
      maxTuition: 0,
      sizeRaw: [],
      undecidedFriendly: true,
      strongAdvising: false,
      gpa: 0,
      satScore: 0,
      targetApplicationCount: 12,
    },
    {
      intendedMajors: ' ',
      testOptional: true,
      learningStyle: '(skip)',
      financialAidNeed: 0,
      campusSetting: '(skip)',
      preferredClimate: ' ',
      advisingNeedLevel: '(skip)',
      accessibilityNeeds: ' ',
      communicationPreference: '(skip)',
    },
  );

  assert.deepEqual(result.locationPreferences, []);
  assert.equal(result.maxTuition, undefined);
  assert.equal(result.gpa, undefined);
  assert.equal(result.satScore, undefined);
  assert.equal(result.campusSetting, undefined);
  assert.equal(result.learningStyle, undefined);
  assert.equal(result.financialAidNeed, undefined);
  assert.equal(result.advisingNeedLevel, undefined);
  assert.equal(result.accessibilityNeeds, undefined);
  assert.equal(result.communicationPreference, undefined);
  assert.equal(result.testOptional, true);
});

test('builds Notion settings mirror content with key profile values', () => {
  const prefs: StudentPreferences = {
    locationPreferences: ['Northeast'],
    undecidedFriendly: true,
    strongAdvising: true,
    targetApplicationCount: 8,
    maxTuition: 45000,
    testOptional: true,
    campusSetting: 'Suburban',
    advisingNeedLevel: 'Medium',
    communicationPreference: 'Email',
    intendedMajors: ['Biology'],
    learningStyle: 'Hybrid',
    financialAidNeed: 40,
    preferredClimate: 'Warm',
    accessibilityNeeds: 'None',
  };

  const content = buildSettingsMirrorContent(prefs);

  assert.ok(content.includes('## Student Preferences'));
  assert.ok(content.includes('- Location: Northeast'));
  assert.ok(content.includes('- Max Tuition: $45,000'));
  assert.ok(content.includes('## Optional Profile Fields'));
  assert.ok(content.includes('- Intended Majors: Biology'));
  assert.ok(content.includes('- Communication Preference: Email'));
});
