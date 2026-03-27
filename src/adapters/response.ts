export type AdapterKind = 'cli' | 'api';

export interface AdapterMeta {
  adapter: AdapterKind;
  action: string;
  timestamp: string;
}

export interface AdapterSuccess<T> {
  ok: true;
  data: T;
  meta: AdapterMeta;
}

export interface AdapterError {
  code: string;
  message: string;
  details?: unknown;
}

export interface AdapterFailure {
  ok: false;
  error: AdapterError;
  meta: AdapterMeta;
}

export type AdapterResult<T> = AdapterSuccess<T> | AdapterFailure;

type ErrorWithCode = Error & { code?: string; details?: unknown; cause?: unknown };

export function normalizeError(error: unknown, fallbackCode = 'INTERNAL_ERROR'): AdapterError {
  if (error instanceof Error) {
    const coded = error as ErrorWithCode;
    return {
      code: coded.code ?? fallbackCode,
      message: coded.message,
      details: coded.details ?? coded.cause,
    };
  }

  if (typeof error === 'string') {
    return {
      code: fallbackCode,
      message: error,
    };
  }

  return {
    code: fallbackCode,
    message: 'An unexpected error occurred.',
    details: error,
  };
}

export async function runAdapterAction<T>(
  adapter: AdapterKind,
  action: string,
  operation: () => Promise<T>,
): Promise<AdapterResult<T>> {
  const meta: AdapterMeta = {
    adapter,
    action,
    timestamp: new Date().toISOString(),
  };

  try {
    const data = await operation();
    return { ok: true, data, meta };
  } catch (error: unknown) {
    return {
      ok: false,
      error: normalizeError(error),
      meta,
    };
  }
}
