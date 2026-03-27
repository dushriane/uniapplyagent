import http, { type IncomingMessage, type ServerResponse } from 'http';
import { UniApplyAgent } from '../UniApplyAgent';
import type { University } from '../types';
import type { Interest } from '../types';
import { runAdapterAction, type AdapterResult } from '../adapters/response';

class ApiValidationError extends Error {
  code = 'VALIDATION_ERROR';

  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'ApiValidationError';
  }
}

type RequestHandler = (body: Record<string, unknown>) => Promise<unknown>;

export interface UniApplyApiServer {
  start(port: number): Promise<void>;
  stop(): Promise<void>;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function statusForResult(result: AdapterResult<unknown>): number {
  if (result.ok) return 200;
  if (result.error.code === 'VALIDATION_ERROR') return 400;
  if (result.error.code === 'NOT_FOUND') return 404;
  return 500;
}

async function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (req.method === 'GET') return {};

  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) return {};

  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new ApiValidationError('Request body must be a JSON object.');
    }
    return parsed as Record<string, unknown>;
  } catch (err: unknown) {
    if (err instanceof ApiValidationError) throw err;
    throw new ApiValidationError('Invalid JSON body.', { raw });
  }
}

function requireString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApiValidationError(`Missing required string field: ${key}`);
  }
  return value.trim();
}

function optionalString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new ApiValidationError(`Field ${key} must be a string.`);
  }
  return value;
}

function optionalDate(body: Record<string, unknown>, key: string): Date | undefined {
  const raw = body[key];
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string') {
    throw new ApiValidationError(`Field ${key} must be an ISO date string.`);
  }
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) {
    throw new ApiValidationError(`Field ${key} must be a valid date string.`);
  }
  return value;
}

function optionalBoolean(body: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const raw = body[key];
  if (raw === undefined) return fallback;
  if (typeof raw !== 'boolean') {
    throw new ApiValidationError(`Field ${key} must be a boolean.`);
  }
  return raw;
}

function validateUniversityStatus(value: string): University['status'] {
  const valid: University['status'][] = [
    'Submitted', 'Admitted', 'Rejected', 'Waitlisted', 'Deferred',
  ];
  if (!valid.includes(value as University['status'])) {
    throw new ApiValidationError(`Invalid status: ${value}.`, { valid });
  }
  return value as University['status'];
}

function validateInterestSource(value: string): Interest['source'] {
  const valid = ['Article', 'Video', 'Quiz', 'Conversation', 'Personal', 'Class', 'Email', 'Clip'] as const;
  if (!valid.includes(value as (typeof valid)[number])) {
    throw new ApiValidationError(`Invalid interest source: ${value}.`, { valid });
  }
  return value as Interest['source'];
}

function validateEventType(value: string):
  | 'Interview Invite'
  | 'Decision Received'
  | 'Campus Visit Invite'
  | 'Waitlisted'
  | 'Scholarship Offer' {
  const valid = [
    'Interview Invite',
    'Decision Received',
    'Campus Visit Invite',
    'Waitlisted',
    'Scholarship Offer',
  ] as const;

  if (!valid.includes(value as (typeof valid)[number])) {
    throw new ApiValidationError(`Invalid post-submit event type: ${value}.`, { valid });
  }

  return value as (typeof valid)[number];
}

export function createApiServer(agent = new UniApplyAgent()): UniApplyApiServer {
  const handlers = new Map<string, RequestHandler>([
    ['POST /api/setup', async () => {
      await agent.setup();
      return { message: 'Setup completed.' };
    }],
    ['POST /api/clip', async (body) => {
      const url = requireString(body, 'url');
      return agent.clipUrl(url);
    }],
    ['POST /api/compare', async (body) => {
      const schoolA = requireString(body, 'schoolA');
      const schoolB = requireString(body, 'schoolB');
      return agent.compareSchools(schoolA, schoolB);
    }],
    ['POST /api/essay', async (body) => {
      const draftText = requireString(body, 'draftText');
      const school = requireString(body, 'school');
      return agent.personalizeEssay(draftText, school);
    }],
    ['POST /api/scan', async (body) => {
      const interactive = optionalBoolean(body, 'interactive', true);
      return agent.scanDeadlines(interactive);
    }],
    ['POST /api/checklist', async (body) => {
      const school = requireString(body, 'school');
      const deadline = optionalDate(body, 'deadline');
      await agent.createChecklist(school, deadline);
      return { message: 'Checklist created.' };
    }],
    ['POST /api/digest', async () => agent.generateDigest()],
    ['POST /api/report', async () => agent.generateHealthReport()],
    ['POST /api/interests/analyze', async () => {
      await agent.analyzeInterests();
      return { message: 'Interest analysis completed.' };
    }],
    ['POST /api/interests/log', async (body) => {
      const title = requireString(body, 'title');
      const field = requireString(body, 'field');
      const source = validateInterestSource(requireString(body, 'source'));
      const strengthValue = body.strength;
      const strength = strengthValue === undefined ? 3 : Number(strengthValue);

      if (!Number.isInteger(strength) || strength < 1 || strength > 5) {
        throw new ApiValidationError('Field strength must be an integer from 1 to 5.');
      }

      await agent.logInterest(
        title,
        field,
        source,
        strength as 1 | 2 | 3 | 4 | 5,
        optionalString(body, 'notes'),
        optionalString(body, 'url'),
      );

      return { message: 'Interest logged.' };
    }],
    ['POST /api/confirm', async (body) => {
      const school = requireString(body, 'school');
      const status = validateUniversityStatus(requireString(body, 'status'));
      const updated = await agent.processConfirmation(school, status);
      return { updated };
    }],
    ['POST /api/post-submit', async (body) => {
      const school = requireString(body, 'school');
      const eventType = validateEventType(requireString(body, 'eventType'));
      await agent.logPostSubmission(school, eventType, undefined, optionalString(body, 'details'));
      return { message: 'Post-submission event logged.' };
    }],
    ['POST /api/archive', async (body) => {
      const school = requireString(body, 'school');
      await agent.archiveUniversity(school);
      return { message: 'University archived.' };
    }],
    ['POST /api/recommendation', async (body) => {
      const school = requireString(body, 'school');
      const recommender = requireString(body, 'recommender');
      const dueDate = optionalDate(body, 'dueDate');
      const emailUrl = optionalString(body, 'emailUrl');
      await agent.trackRecommendation(school, recommender, dueDate, emailUrl);
      return { message: 'Recommendation tracked.' };
    }],
    ['GET /api/status', async () => {
      await agent.showStatus();
      return { message: 'Status dashboard rendered in server logs.' };
    }],
  ]);

  const server = http.createServer(async (req, res) => {
    if (!req.url || !req.method) {
      sendJson(res, 400, {
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'Request is missing method or URL.' },
      });
      return;
    }

    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, {
        ok: true,
        data: { status: 'ok', service: 'uniapply-api' },
      });
      return;
    }

    const routeKey = `${req.method.toUpperCase()} ${url.pathname}`;
    const handler = handlers.get(routeKey);

    if (!handler) {
      sendJson(res, 404, {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `No route registered for ${routeKey}`,
        },
      });
      return;
    }

    const result = await runAdapterAction('api', routeKey, async () => {
      const body = await parseBody(req);
      return handler(body);
    });

    sendJson(res, statusForResult(result), result);
  });

  return {
    start(port: number): Promise<void> {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, () => {
          server.removeListener('error', reject);
          resolve();
        });
      });
    },
    stop(): Promise<void> {
      return new Promise((resolve, reject) => {
        server.close((err?: Error) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}
