/**
 * NotionManager — high-level data access layer for all UniApply databases.
 *
 * Every public method:
 *  • respects READ_ONLY mode (writes are silently skipped and logged to console)
 *  • maps Notion API responses ↔ typed domain objects
 *  • logs every operation to the ActivityLog database (if populated)
 */

import { Client, isFullPage } from '@notionhq/client';
import type {
  CreatePageParameters,
  UpdatePageParameters,
  QueryDatabaseParameters,
} from '@notionhq/client/build/src/api-endpoints';
import { getNotionClient } from './client';
import { loadConfig, saveDatabaseIds } from '../config';
import {
  UNIVERSITIES_PROPERTIES,
  PROGRAMS_PROPERTIES,
  ESSAYS_PROPERTIES,
  TASKS_PROPERTIES,
  INTERESTS_PROPERTIES,
  ACTIVITY_LOG_PROPERTIES,
} from './schemas';
import type {
  University,
  Program,
  Essay,
  Task,
  Interest,
  ActivityLogEntry,
  UniversityStatus,
  DatabaseIds,
} from '../types';

// ── Property helpers ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NotionProp = any;

function text(value: string): NotionProp {
  return { rich_text: [{ text: { content: value.slice(0, 2000) } }] };
}
function title(value: string): NotionProp {
  return { title: [{ text: { content: value.slice(0, 2000) } }] };
}
function select(value: string): NotionProp {
  return { select: { name: value } };
}
function multiSelect(values: string[]): NotionProp {
  return { multi_select: values.map((v) => ({ name: v })) };
}
function checkbox(value: boolean): NotionProp {
  return { checkbox: value };
}
function num(value: number): NotionProp {
  return { number: value };
}
function date(value: Date): NotionProp {
  return { date: { start: value.toISOString().split('T')[0] } };
}
function url(value: string): NotionProp {
  return { url: value };
}

function getPropText(page: NotionProp, key: string): string {
  const prop = page.properties?.[key];
  if (!prop) return '';
  if (prop.title) return prop.title.map((t: NotionProp) => t.plain_text).join('');
  if (prop.rich_text) return prop.rich_text.map((t: NotionProp) => t.plain_text).join('');
  return '';
}
function getPropSelect(page: NotionProp, key: string): string {
  return page.properties?.[key]?.select?.name ?? '';
}
function getPropMultiSelect(page: NotionProp, key: string): string[] {
  return (page.properties?.[key]?.multi_select ?? []).map((o: NotionProp) => o.name);
}
function getPropCheckbox(page: NotionProp, key: string): boolean {
  return page.properties?.[key]?.checkbox ?? false;
}
function getPropNumber(page: NotionProp, key: string): number | undefined {
  const n = page.properties?.[key]?.number;
  return n !== null && n !== undefined ? (n as number) : undefined;
}
function getPropDate(page: NotionProp, key: string): Date | undefined {
  const d = page.properties?.[key]?.date?.start;
  return d ? new Date(d) : undefined;
}
function getPropUrl(page: NotionProp, key: string): string | undefined {
  return page.properties?.[key]?.url ?? undefined;
}

// ── NotionManager class ───────────────────────────────────────────────────────

export class NotionManager {
  private client: Client;
  private dbIds: DatabaseIds;
  private readOnly: boolean;

  constructor() {
    this.client = getNotionClient();
    const config = loadConfig();
    this.dbIds = config.databaseIds;
    this.readOnly = config.readOnlyMode;
  }

  // ── Database bootstrap ─────────────────────────────────────────────────────

  /**
   * Creates all six databases as children of the given parent page.
   * Returns the created database IDs and saves them to config.
   */
  async createAllDatabases(parentPageId: string): Promise<DatabaseIds> {
    if (this.readOnly) throw new Error('Cannot create databases in READ_ONLY mode.');

    const create = async (titleText: string, props: Record<string, NotionProp>) => {
      const db = await this.client.databases.create({
        parent: { type: 'page_id', page_id: parentPageId },
        title: [{ type: 'text', text: { content: titleText } }],
        properties: props,
        is_inline: false,
      });
      return db.id;
    };

    const ids: DatabaseIds = {
      universities: await create('🎓 Universities', UNIVERSITIES_PROPERTIES),
      programs: await create('📚 Programs & Majors', PROGRAMS_PROPERTIES),
      essays: await create('✍️ Essays & Documents', ESSAYS_PROPERTIES),
      tasks: await create('✅ Timeline & Tasks', TASKS_PROPERTIES),
      interests: await create('💡 Interests Log', INTERESTS_PROPERTIES),
      activityLog: await create('🔍 Activity Log', ACTIVITY_LOG_PROPERTIES),
    };

    saveDatabaseIds(ids);
    this.dbIds = { ...this.dbIds, ...ids };
    return ids;
  }

  /** Creates the Dashboard page that links to all databases. */
  async createDashboardPage(parentPageId: string): Promise<string> {
    if (this.readOnly) throw new Error('READ_ONLY mode.');
    const page = await this.client.pages.create({
      parent: { type: 'page_id', page_id: parentPageId },
      properties: {
        title: title('📊 UniApply Dashboard'),
      },
      children: [
        {
          object: 'block',
          type: 'heading_1',
          heading_1: { rich_text: [{ text: { content: '📊 UniApply — Application Tracker' } }] },
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                text: {
                  content:
                    'Managed by the UniApply Agent. Use the CLI to update statuses, generate reports, and personalize essays.',
                },
              },
            ],
          },
        },
        {
          object: 'block',
          type: 'divider',
          divider: {},
        },
        {
          object: 'block',
          type: 'callout',
          callout: {
            rich_text: [
              {
                text: {
                  content:
                    'Run `uniapply scan` for deadline alerts  •  `uniapply report` for weekly health check  •  `uniapply digest` for exploration summary',
                },
              },
            ],
            icon: { emoji: '🤖' },
            color: 'blue_background',
          },
        },
      ],
    });
    const id = page.id;
    saveDatabaseIds({ dashboardPageId: id });
    return id;
  }

  // ── Universities CRUD ──────────────────────────────────────────────────────

  async createUniversity(u: Omit<University, 'notionId'>): Promise<string> {
    this.guardWrite();
    const dbId = this.requireDb('universities');
    const props: Record<string, NotionProp> = {
      Name: title(u.name),
      Status: select(u.status),
    };
    if (u.url) props['URL'] = url(u.url);
    if (u.location) props['Location'] = text(u.location);
    if (u.state) props['State'] = text(u.state);
    if (u.size) props['Size'] = select(u.size);
    if (u.costRange) props['Cost Range'] = select(u.costRange);
    if (u.fitScore !== undefined) props['Fit Score'] = num(u.fitScore);
    if (u.priority) props['Priority'] = select(u.priority);
    if (u.applicationDeadline) props['Application Deadline'] = date(u.applicationDeadline);
    if (u.earlyDeadline) props['Early Deadline'] = date(u.earlyDeadline);
    if (u.acceptanceRate !== undefined) props['Acceptance Rate'] = num(u.acceptanceRate);
    if (u.undecidedFriendly !== undefined) props['Undecided Friendly'] = checkbox(u.undecidedFriendly);
    if (u.openCurriculum !== undefined) props['Open Curriculum'] = checkbox(u.openCurriculum);
    if (u.firstYearFlexibility !== undefined) props['First-Year Flexibility'] = checkbox(u.firstYearFlexibility);
    if (u.earlyDeclarationRequired !== undefined) props['Early Declaration Required'] = checkbox(u.earlyDeclarationRequired);
    if (u.curriculumFlexibility) props['Curriculum Flexibility'] = select(u.curriculumFlexibility);
    if (u.advisingStrength) props['Advising Strength'] = select(u.advisingStrength);
    if (u.tags?.length) props['Tags'] = multiSelect(u.tags);
    if (u.portalUrl) props['Portal URL'] = url(u.portalUrl);
    if (u.notes) props['Notes'] = text(u.notes);

    const page = await this.client.pages.create({
      parent: { database_id: dbId },
      properties: props as CreatePageParameters['properties'],
    });
    await this.logActivity(
      `Added university: ${u.name}`,
      'createUniversity',
      'Write',
      u.name,
      'Completed',
    );
    return page.id;
  }

  async updateUniversity(id: string, updates: Partial<University>): Promise<void> {
    this.guardWrite();
    const props: Record<string, NotionProp> = {};
    if (updates.name) props['Name'] = title(updates.name);
    if (updates.status) props['Status'] = select(updates.status);
    if (updates.url) props['URL'] = url(updates.url);
    if (updates.location) props['Location'] = text(updates.location);
    if (updates.size) props['Size'] = select(updates.size);
    if (updates.costRange) props['Cost Range'] = select(updates.costRange);
    if (updates.fitScore !== undefined) props['Fit Score'] = num(updates.fitScore);
    if (updates.priority) props['Priority'] = select(updates.priority);
    if (updates.applicationDeadline) props['Application Deadline'] = date(updates.applicationDeadline);
    if (updates.undecidedFriendly !== undefined) props['Undecided Friendly'] = checkbox(updates.undecidedFriendly);
    if (updates.curriculumFlexibility) props['Curriculum Flexibility'] = select(updates.curriculumFlexibility);
    if (updates.advisingStrength) props['Advising Strength'] = select(updates.advisingStrength);
    if (updates.earlyDeclarationRequired !== undefined) props['Early Declaration Required'] = checkbox(updates.earlyDeclarationRequired);
    if (updates.tags) props['Tags'] = multiSelect(updates.tags);
    if (updates.notes) props['Notes'] = text(updates.notes);

    await this.client.pages.update({ page_id: id, properties: props as UpdatePageParameters['properties'] });
    await this.logActivity(
      `Updated university (${id})`,
      'updateUniversity',
      'Write',
      id,
      'Completed',
    );
  }

  async queryUniversities(filter?: Partial<{ status: UniversityStatus; tag: string }>): Promise<University[]> {
    const dbId = this.requireDb('universities');
    const filterParam: QueryDatabaseParameters['filter'] = filter?.status
      ? { property: 'Status', select: { equals: filter.status } }
      : undefined;

    const response = await this.client.databases.query({
      database_id: dbId,
      ...(filterParam ? { filter: filterParam } : {}),
      sorts: [{ property: 'Fit Score', direction: 'descending' }],
    });

    return response.results.filter(isFullPage).map((page) => ({
      notionId: page.id,
      name: getPropText(page, 'Name'),
      url: getPropUrl(page, 'URL'),
      location: getPropText(page, 'Location'),
      state: getPropText(page, 'State') || undefined,
      size: getPropSelect(page, 'Size') as University['size'] || undefined,
      costRange: getPropSelect(page, 'Cost Range') as University['costRange'] || undefined,
      fitScore: getPropNumber(page, 'Fit Score'),
      status: (getPropSelect(page, 'Status') || 'Exploratory') as UniversityStatus,
      priority: getPropSelect(page, 'Priority') as University['priority'] || undefined,
      applicationDeadline: getPropDate(page, 'Application Deadline'),
      earlyDeadline: getPropDate(page, 'Early Deadline'),
      acceptanceRate: getPropNumber(page, 'Acceptance Rate'),
      undecidedFriendly: getPropCheckbox(page, 'Undecided Friendly'),
      openCurriculum: getPropCheckbox(page, 'Open Curriculum'),
      firstYearFlexibility: getPropCheckbox(page, 'First-Year Flexibility'),
      earlyDeclarationRequired: getPropCheckbox(page, 'Early Declaration Required'),
      curriculumFlexibility: getPropSelect(page, 'Curriculum Flexibility') as University['curriculumFlexibility'] || undefined,
      advisingStrength: getPropSelect(page, 'Advising Strength') as University['advisingStrength'] || undefined,
      tags: getPropMultiSelect(page, 'Tags'),
      portalUrl: getPropUrl(page, 'Portal URL'),
      notes: getPropText(page, 'Notes') || undefined,
    }));
  }

  // ── Tasks CRUD ─────────────────────────────────────────────────────────────

  async createTask(task: Omit<Task, 'notionId'>): Promise<string> {
    this.guardWrite();
    const dbId = this.requireDb('tasks');
    const props: Record<string, NotionProp> = {
      Task: title(task.title),
      Status: select(task.status),
      Priority: select(task.priority),
      Type: select(task.type),
    };
    if (task.universityName) props['University'] = text(task.universityName);
    if (task.dueDate) props['Due Date'] = date(task.dueDate);
    if (task.notes) props['Notes'] = text(task.notes);
    if (task.emailThreadLink) props['Email Thread'] = url(task.emailThreadLink);

    const page = await this.client.pages.create({
      parent: { database_id: dbId },
      properties: props as CreatePageParameters['properties'],
    });
    return page.id;
  }

  async queryTasks(filter?: { status?: string; universityName?: string }): Promise<Task[]> {
    const dbId = this.requireDb('tasks');
    const filterParam: QueryDatabaseParameters['filter'] = filter?.status
      ? { property: 'Status', select: { equals: filter.status } }
      : undefined;

    const response = await this.client.databases.query({
      database_id: dbId,
      ...(filterParam ? { filter: filterParam } : {}),
      sorts: [{ property: 'Due Date', direction: 'ascending' }],
    });

    return response.results.filter(isFullPage).map((page) => ({
      notionId: page.id,
      title: getPropText(page, 'Task'),
      universityName: getPropText(page, 'University') || undefined,
      type: (getPropSelect(page, 'Type') || 'Other') as Task['type'],
      status: (getPropSelect(page, 'Status') || 'Not Started') as Task['status'],
      priority: (getPropSelect(page, 'Priority') || 'Medium') as Task['priority'],
      dueDate: getPropDate(page, 'Due Date'),
      notes: getPropText(page, 'Notes') || undefined,
      emailThreadLink: getPropUrl(page, 'Email Thread') || undefined,
    }));
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<void> {
    this.guardWrite();
    const props: Record<string, NotionProp> = {};
    if (updates.status) props['Status'] = select(updates.status);
    if (updates.priority) props['Priority'] = select(updates.priority);
    if (updates.dueDate) props['Due Date'] = date(updates.dueDate);
    if (updates.notes) props['Notes'] = text(updates.notes);
    await this.client.pages.update({ page_id: id, properties: props as UpdatePageParameters['properties'] });
  }

  // ── Interests CRUD ─────────────────────────────────────────────────────────

  async createInterest(interest: Omit<Interest, 'notionId'>): Promise<string> {
    this.guardWrite();
    const dbId = this.requireDb('interests');
    const props: Record<string, NotionProp> = {
      Title: title(interest.title),
      Type: select(interest.type),
      Source: select(interest.source),
      'Date Added': date(interest.dateAdded),
    };
    if (interest.field) props['Field'] = text(interest.field);
    if (interest.subfield) props['Subfield'] = text(interest.subfield);
    if (interest.strength !== undefined) props['Strength'] = num(interest.strength);
    if (interest.tags?.length) props['Tags'] = multiSelect(interest.tags);
    if (interest.url) props['URL'] = url(interest.url);
    if (interest.notes) props['Notes'] = text(interest.notes);

    const page = await this.client.pages.create({
      parent: { database_id: dbId },
      properties: props as CreatePageParameters['properties'],
    });
    return page.id;
  }

  async queryInterests(): Promise<Interest[]> {
    const dbId = this.requireDb('interests');
    const response = await this.client.databases.query({
      database_id: dbId,
      sorts: [{ property: 'Date Added', direction: 'descending' }],
    });
    return response.results.filter(isFullPage).map((page) => ({
      notionId: page.id,
      title: getPropText(page, 'Title'),
      type: (getPropSelect(page, 'Type') || 'Field') as Interest['type'],
      source: (getPropSelect(page, 'Source') || 'Personal') as Interest['source'],
      field: getPropText(page, 'Field') || undefined,
      subfield: getPropText(page, 'Subfield') || undefined,
      strength: getPropNumber(page, 'Strength'),
      tags: getPropMultiSelect(page, 'Tags'),
      url: getPropUrl(page, 'URL') || undefined,
      notes: getPropText(page, 'Notes') || undefined,
      dateAdded: getPropDate(page, 'Date Added') ?? new Date(),
    }));
  }

  // ── Essay CRUD ─────────────────────────────────────────────────────────────

  async createEssay(essay: Omit<Essay, 'notionId'>): Promise<string> {
    this.guardWrite();
    const dbId = this.requireDb('essays');
    const props: Record<string, NotionProp> = {
      Title: title(essay.title),
      Type: select(essay.type),
      Status: select(essay.status),
    };
    if (essay.universityName) props['University'] = text(essay.universityName);
    if (essay.prompt) props['Prompt'] = text(essay.prompt);
    if (essay.wordLimit !== undefined) props['Word Limit'] = num(essay.wordLimit);
    if (essay.wordCount !== undefined) props['Word Count'] = num(essay.wordCount);
    if (essay.dueDate) props['Due Date'] = date(essay.dueDate);
    if (essay.driveLink) props['Drive Link'] = url(essay.driveLink);
    if (essay.notes) props['Notes'] = text(essay.notes);

    const page = await this.client.pages.create({
      parent: { database_id: dbId },
      properties: props as CreatePageParameters['properties'],
    });
    return page.id;
  }

  async queryEssays(universityName?: string): Promise<Essay[]> {
    const dbId = this.requireDb('essays');
    const response = await this.client.databases.query({
      database_id: dbId,
      sorts: [{ property: 'Due Date', direction: 'ascending' }],
    });
    const all = response.results.filter(isFullPage).map((page) => ({
      notionId: page.id,
      title: getPropText(page, 'Title'),
      universityName: getPropText(page, 'University') || undefined,
      type: (getPropSelect(page, 'Type') || 'Other') as Essay['type'],
      status: (getPropSelect(page, 'Status') || 'Not Started') as Essay['status'],
      prompt: getPropText(page, 'Prompt') || undefined,
      wordLimit: getPropNumber(page, 'Word Limit'),
      wordCount: getPropNumber(page, 'Word Count'),
      dueDate: getPropDate(page, 'Due Date'),
      driveLink: getPropUrl(page, 'Drive Link') || undefined,
      notes: getPropText(page, 'Notes') || undefined,
    }));
    return universityName
      ? all.filter((e) => e.universityName?.toLowerCase() === universityName.toLowerCase())
      : all;
  }

  // ── Append rich content blocks to a page ──────────────────────────────────

  async appendToPage(pageId: string, markdownContent: string): Promise<void> {
    this.guardWrite();
    // Minimal paragraph-per-line block conversion
    const lines = markdownContent.split('\n').filter((l) => l.trim());
    const blocks = lines.map((line) => ({
      object: 'block' as const,
      type: 'paragraph' as const,
      paragraph: { rich_text: [{ text: { content: line.slice(0, 2000) } }] },
    }));

    // Notion API allows max 100 children per request
    for (let i = 0; i < blocks.length; i += 100) {
      await this.client.blocks.children.append({
        block_id: pageId,
        children: blocks.slice(i, i + 100),
      });
    }
  }

  /** Create a new sub-page under the dashboard (or parent). */
  async createPage(
    parentId: string,
    titleText: string,
    contentBlocks?: object[],
  ): Promise<string> {
    this.guardWrite();
    const page = await this.client.pages.create({
      parent: { type: 'page_id', page_id: parentId },
      properties: { title: title(titleText) },
      ...(contentBlocks ? { children: contentBlocks as CreatePageParameters['children'] } : {}),
    });
    return page.id;
  }

  // ── Activity Logging ───────────────────────────────────────────────────────

  async logActivity(
    action: string,
    agentAction: string,
    type: ActivityLogEntry['type'],
    target: string,
    status: ActivityLogEntry['status'],
    details?: string,
  ): Promise<void> {
    if (!this.dbIds.activityLog) return;  // log DB not yet set up; skip silently
    if (this.readOnly) return;
    try {
      const props: Record<string, NotionProp> = {
        Action: title(action.slice(0, 100)),
        'Agent Action': text(agentAction),
        Type: select(type),
        Target: text(target.slice(0, 500)),
        Status: select(status),
        Timestamp: date(new Date()),
      };
      if (details) props['Details'] = text(details.slice(0, 1000));
      await this.client.pages.create({
        parent: { database_id: this.dbIds.activityLog },
        properties: props as CreatePageParameters['properties'],
      });
    } catch {
      // Never let logging errors bubble up and crash the main flow
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private guardWrite(): void {
    if (this.readOnly) throw new Error('Agent is in READ_ONLY mode. Set READ_ONLY=false to allow writes.');
  }

  private requireDb(key: keyof typeof this.dbIds): string {
    const id = this.dbIds[key];
    if (!id)
      throw new Error(
        `Database "${key}" is not configured. Run \`uniapply setup\` to initialise your workspace.`,
      );
    return id;
  }

  getDatabaseIds(): DatabaseIds {
    return { ...this.dbIds };
  }
}
