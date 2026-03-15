import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { AgentConfig, DatabaseIds, StudentPreferences } from '../types';

dotenv.config();

// ── Helpers ───────────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}\nRun 'cp .env.example .env' and fill in your values.`);
  return val;
}

function optionalEnv(key: string): string | undefined {
  const val = process.env[key];
  return val && val.trim() !== '' ? val.trim() : undefined;
}

// ── Persistent config file (augments .env) ────────────────────────────────────

export const CONFIG_PATH = path.join(process.cwd(), '.uniapply-config.json');

interface PersistedConfig {
  databaseIds?: DatabaseIds;
  preferences?: Partial<StudentPreferences>;
}

function loadPersistedConfig(): PersistedConfig {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as PersistedConfig;
  } catch {
    return {};
  }
}

// ── Main config loader ─────────────────────────────────────────────────────────

const DEFAULT_PREFERENCES: StudentPreferences = {
  locationPreferences: [],
  undecidedFriendly: true,
  strongAdvising: true,
  targetApplicationCount: 12,
  safetyCount: 3,
  matchCount: 5,
  reachCount: 4,
};

export function loadConfig(): AgentConfig {
  const persisted = loadPersistedConfig();

  // Database IDs: env takes precedence over persisted file
  const databaseIds: DatabaseIds = {
    universities: optionalEnv('NOTION_UNIVERSITIES_DB') ?? persisted.databaseIds?.universities,
    programs: optionalEnv('NOTION_PROGRAMS_DB') ?? persisted.databaseIds?.programs,
    essays: optionalEnv('NOTION_ESSAYS_DB') ?? persisted.databaseIds?.essays,
    tasks: optionalEnv('NOTION_TASKS_DB') ?? persisted.databaseIds?.tasks,
    interests: optionalEnv('NOTION_INTERESTS_DB') ?? persisted.databaseIds?.interests,
    activityLog: optionalEnv('NOTION_ACTIVITY_LOG_DB') ?? persisted.databaseIds?.activityLog,
    settingsPageId: optionalEnv('NOTION_SETTINGS_PAGE_ID') ?? persisted.databaseIds?.settingsPageId,
    dashboardPageId: optionalEnv('NOTION_DASHBOARD_PAGE_ID') ?? persisted.databaseIds?.dashboardPageId,
  };

  const preferences: StudentPreferences = {
    ...DEFAULT_PREFERENCES,
    ...(persisted.preferences ?? {}),
  };

  return {
    notionToken: requireEnv('NOTION_TOKEN'),
    openaiApiKey: optionalEnv('OPENAI_API_KEY'),
    gmailUser: optionalEnv('GMAIL_USER'),
    databaseIds,
    preferences,
    readOnlyMode: process.env['READ_ONLY'] === 'true',
    noAutoSend: process.env['NO_AUTO_SEND'] !== 'false',   // default true
    scheduleEnabled: process.env['SCHEDULE_ENABLED'] === 'true',
  };
}

// ── Persistence helpers ────────────────────────────────────────────────────────

export function saveDatabaseIds(ids: Partial<DatabaseIds>): void {
  const persisted = loadPersistedConfig();
  persisted.databaseIds = { ...(persisted.databaseIds ?? {}), ...ids };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(persisted, null, 2), 'utf-8');
  patchDotEnv(ids);
}

export function savePreferences(prefs: Partial<StudentPreferences>): void {
  const persisted = loadPersistedConfig();
  persisted.preferences = { ...(persisted.preferences ?? {}), ...prefs };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(persisted, null, 2), 'utf-8');
}

/** Write database IDs back into the .env file so they survive across sessions */
function patchDotEnv(ids: Partial<DatabaseIds>): void {
  const envPath = path.join(process.cwd(), '.env');
  const mapping: Record<string, string | undefined> = {
    NOTION_UNIVERSITIES_DB: ids.universities,
    NOTION_PROGRAMS_DB: ids.programs,
    NOTION_ESSAYS_DB: ids.essays,
    NOTION_TASKS_DB: ids.tasks,
    NOTION_INTERESTS_DB: ids.interests,
    NOTION_ACTIVITY_LOG_DB: ids.activityLog,
    NOTION_SETTINGS_PAGE_ID: ids.settingsPageId,
    NOTION_DASHBOARD_PAGE_ID: ids.dashboardPageId,
  };

  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
  for (const [key, value] of Object.entries(mapping)) {
    if (!value) continue;
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  }
  fs.writeFileSync(envPath, content.replace(/^\n/, ''), 'utf-8');
}
