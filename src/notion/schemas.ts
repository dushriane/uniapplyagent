/**
 * Notion database property schema definitions.
 * Used by OnboardingAgent to auto-create all required databases on first run.
 *
 * Each export is a `properties` object compatible with the Notion SDK's
 * `databases.create()` endpoint.
 */

// ── Universities ──────────────────────────────────────────────────────────────

export const UNIVERSITIES_PROPERTIES = {
  Name: { title: {} },
  URL: { url: {} },
  Location: { rich_text: {} },
  State: { rich_text: {} },
  Size: {
    select: {
      options: [
        { name: 'Small (<5k)', color: 'green' },
        { name: 'Medium (5k–15k)', color: 'yellow' },
        { name: 'Large (15k–30k)', color: 'orange' },
        { name: 'Very Large (30k+)', color: 'red' },
      ],
    },
  },
  'Cost Range': {
    select: {
      options: [
        { name: 'Under $30k', color: 'green' },
        { name: '$30k–$45k', color: 'yellow' },
        { name: '$45k–$60k', color: 'orange' },
        { name: 'Over $60k', color: 'red' },
      ],
    },
  },
  'Fit Score': { number: { format: 'number' as const } },
  Status: {
    select: {
      options: [
        { name: 'Exploratory', color: 'gray' },
        { name: 'Researching', color: 'blue' },
        { name: 'Applying', color: 'yellow' },
        { name: 'Submitted', color: 'purple' },
        { name: 'Admitted', color: 'green' },
        { name: 'Rejected', color: 'red' },
        { name: 'Waitlisted', color: 'orange' },
        { name: 'Deferred', color: 'pink' },
        { name: 'Archived', color: 'default' },
      ],
    },
  },
  Priority: {
    select: {
      options: [
        { name: 'Safety', color: 'green' },
        { name: 'Match', color: 'yellow' },
        { name: 'Reach', color: 'orange' },
        { name: 'Dream', color: 'red' },
      ],
    },
  },
  'Application Deadline': { date: {} },
  'Early Deadline': { date: {} },
  'Acceptance Rate': { number: { format: 'percent' as const } },
  'Undecided Friendly': { checkbox: {} },
  'Open Curriculum': { checkbox: {} },
  'First-Year Flexibility': { checkbox: {} },
  'Early Declaration Required': { checkbox: {} },
  'Curriculum Flexibility': {
    select: {
      options: [
        { name: 'High', color: 'green' },
        { name: 'Medium', color: 'yellow' },
        { name: 'Low', color: 'red' },
      ],
    },
  },
  'Advising Strength': {
    select: {
      options: [
        { name: 'Excellent', color: 'green' },
        { name: 'Good', color: 'blue' },
        { name: 'Fair', color: 'yellow' },
        { name: 'Poor', color: 'red' },
      ],
    },
  },
  Tags: { multi_select: { options: [] as { name: string; color: string }[] } },
  'Portal URL': { url: {} },
  Notes: { rich_text: {} },
} as const;

// ── Programs / Majors ─────────────────────────────────────────────────────────

export const PROGRAMS_PROPERTIES = {
  Name: { title: {} },
  University: { rich_text: {} },            // denormalised name; relation added post-create
  Field: { rich_text: {} },
  Subfield: { rich_text: {} },
  'Undecided Friendly': { checkbox: {} },
  'Early Declaration Required': { checkbox: {} },
  'Curriculum Flexibility': {
    select: {
      options: [
        { name: 'High', color: 'green' },
        { name: 'Medium', color: 'yellow' },
        { name: 'Low', color: 'red' },
      ],
    },
  },
  'Advising Strength': {
    select: {
      options: [
        { name: 'Excellent', color: 'green' },
        { name: 'Good', color: 'blue' },
        { name: 'Fair', color: 'yellow' },
        { name: 'Poor', color: 'red' },
      ],
    },
  },
  Tags: { multi_select: { options: [] as { name: string; color: string }[] } },
  URL: { url: {} },
  Notes: { rich_text: {} },
} as const;

// ── Essays / Documents ────────────────────────────────────────────────────────

export const ESSAYS_PROPERTIES = {
  Title: { title: {} },
  University: { rich_text: {} },
  Type: {
    select: {
      options: [
        { name: 'Personal Statement', color: 'blue' },
        { name: 'Supplemental Essay', color: 'purple' },
        { name: 'Resume', color: 'gray' },
        { name: 'Transcript', color: 'gray' },
        { name: 'Test Scores', color: 'gray' },
        { name: 'Letter of Recommendation', color: 'yellow' },
        { name: 'Financial Aid', color: 'orange' },
        { name: 'Portfolio', color: 'pink' },
        { name: 'Other', color: 'default' },
      ],
    },
  },
  Status: {
    select: {
      options: [
        { name: 'Not Started', color: 'gray' },
        { name: 'Brainstorming', color: 'yellow' },
        { name: 'Drafting', color: 'blue' },
        { name: 'In Review', color: 'orange' },
        { name: 'Polished', color: 'green' },
        { name: 'Submitted', color: 'purple' },
      ],
    },
  },
  Prompt: { rich_text: {} },
  'Word Limit': { number: { format: 'number' as const } },
  'Word Count': { number: { format: 'number' as const } },
  'Due Date': { date: {} },
  'Drive Link': { url: {} },
  Notes: { rich_text: {} },
} as const;

// ── Timeline / Tasks ──────────────────────────────────────────────────────────

export const TASKS_PROPERTIES = {
  Task: { title: {} },
  University: { rich_text: {} },
  Type: {
    select: {
      options: [
        { name: 'Application', color: 'blue' },
        { name: 'Essay', color: 'purple' },
        { name: 'Recommendation', color: 'yellow' },
        { name: 'Document', color: 'gray' },
        { name: 'Interview', color: 'orange' },
        { name: 'Decision', color: 'green' },
        { name: 'Financial Aid', color: 'red' },
        { name: 'Campus Visit', color: 'pink' },
        { name: 'Other', color: 'default' },
      ],
    },
  },
  Status: {
    select: {
      options: [
        { name: 'Not Started', color: 'gray' },
        { name: 'In Progress', color: 'yellow' },
        { name: 'Completed', color: 'green' },
        { name: 'Overdue', color: 'red' },
        { name: 'Waived', color: 'default' },
      ],
    },
  },
  Priority: {
    select: {
      options: [
        { name: 'Critical', color: 'red' },
        { name: 'High', color: 'orange' },
        { name: 'Medium', color: 'yellow' },
        { name: 'Low', color: 'gray' },
      ],
    },
  },
  'Due Date': { date: {} },
  Notes: { rich_text: {} },
  'Email Thread': { url: {} },
} as const;

// ── Interests / Potential Majors ──────────────────────────────────────────────

export const INTERESTS_PROPERTIES = {
  Title: { title: {} },
  Type: {
    select: {
      options: [
        { name: 'Major', color: 'blue' },
        { name: 'Field', color: 'purple' },
        { name: 'Career', color: 'green' },
        { name: 'Activity', color: 'yellow' },
        { name: 'Value', color: 'pink' },
        { name: 'Course Topic', color: 'orange' },
      ],
    },
  },
  Source: {
    select: {
      options: [
        { name: 'Article', color: 'blue' },
        { name: 'Video', color: 'red' },
        { name: 'Quiz', color: 'purple' },
        { name: 'Conversation', color: 'yellow' },
        { name: 'Personal', color: 'green' },
        { name: 'Class', color: 'orange' },
        { name: 'Email', color: 'gray' },
        { name: 'Clip', color: 'pink' },
      ],
    },
  },
  Field: { rich_text: {} },
  Subfield: { rich_text: {} },
  Strength: { number: { format: 'number' as const } },  // 1–5
  Tags: { multi_select: { options: [] as { name: string; color: string }[] } },
  URL: { url: {} },
  Notes: { rich_text: {} },
  'Date Added': { date: {} },
} as const;

// ── Student Profile (mirrored from local config) ─────────────────────────

export const PROFILE_PROPERTIES = {
  Title: { title: {} },  // Always "Student Profile"
  'Location Preferences': { multi_select: { options: [] as { name: string; color: string }[] } },
  'Max Tuition': { number: { format: 'dollar' as const } },
  'School Size Preferences': { multi_select: { options: [] as { name: string; color: string }[] } },
  'GPA': { number: { format: 'number' as const } },
  'SAT Score': { number: { format: 'number' as const } },
  'ACT Score': { number: { format: 'number' as const } },
  'Target Application Count': { number: { format: 'number' as const } },
  'Undecided Friendly': { checkbox: {} },
  'Strong Advising': { checkbox: {} },
  'Test Optional': { checkbox: {} },
  'Intended Majors': { multi_select: { options: [] as { name: string; color: string }[] } },
  'Learning Style': { rich_text: {} },
  'Financial Aid Need %': { number: { format: 'percent' as const } },
  'Campus Setting': {
    select: {
      options: [
        { name: 'Urban', color: 'blue' },
        { name: 'Suburban', color: 'yellow' },
        { name: 'Rural', color: 'green' },
      ],
    },
  },
  'Preferred Climate': { rich_text: {} },
  'Advising Need Level': {
    select: {
      options: [
        { name: 'Low', color: 'green' },
        { name: 'Medium', color: 'yellow' },
        { name: 'High', color: 'red' },
      ],
    },
  },
  'Accessibility Needs': { rich_text: {} },
  'Communication Preference': {
    select: {
      options: [
        { name: 'Email', color: 'blue' },
        { name: 'SMS', color: 'green' },
        { name: 'Both', color: 'purple' },
      ],
    },
  },
  'Distance From Home (miles)': { number: { format: 'number' as const } },
  'Last Updated': { date: {} },
} as const;

// ── Activity Log ──────────────────────────────────────────────────────────────

export const ACTIVITY_LOG_PROPERTIES = {
  Action: { title: {} },
  'Agent Action': { rich_text: {} },
  Type: {
    select: {
      options: [
        { name: 'Read', color: 'gray' },
        { name: 'Write', color: 'blue' },
        { name: 'Email Parsed', color: 'yellow' },
        { name: 'Email Draft', color: 'orange' },
        { name: 'Calendar', color: 'green' },
        { name: 'Scoring', color: 'purple' },
        { name: 'Setup', color: 'pink' },
        { name: 'Archive', color: 'gray' },
        { name: 'AI Analysis', color: 'red' },
      ],
    },
  },
  Target: { rich_text: {} },
  Status: {
    select: {
      options: [
        { name: 'Completed', color: 'green' },
        { name: 'Pending', color: 'yellow' },
        { name: 'Failed', color: 'red' },
        { name: 'Skipped (User)', color: 'gray' },
      ],
    },
  },
  Timestamp: { date: {} },
  Details: { rich_text: {} },
} as const;

// ── Display names for CLI output ──────────────────────────────────────────────

export const DB_DISPLAY_NAMES: Record<string, string> = {
  universities: '🎓 Universities',
  programs: '📚 Programs & Majors',
  essays: '✍️  Essays & Documents',
  tasks: '✅ Timeline & Tasks',
  interests: '💡 Interests Log',
  activityLog: '🔍 Activity Log',
};
