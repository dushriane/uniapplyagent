import axios, { AxiosInstance } from 'axios';

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    adapter: string;
    action: string;
    timestamp: string;
  };
}

export class UniApplyApiClient {
  private client: AxiosInstance;

  constructor(baseUrl = 'http://localhost:8787') {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async setup(): Promise<void> {
    const res = await this.client.post<ApiResponse<{ message: string }>>('/api/setup');
    if (!res.data.ok) throw new Error(res.data.error?.message ?? 'Setup failed');
  }

  async clip(url: string): Promise<unknown> {
    const res = await this.client.post<ApiResponse<unknown>>('/api/clip', { url });
    if (!res.data.ok) throw new Error(res.data.error?.message ?? 'Clip failed');
    return res.data.data;
  }

  async compare(schoolA: string, schoolB: string): Promise<unknown> {
    const res = await this.client.post<ApiResponse<unknown>>('/api/compare', { schoolA, schoolB });
    if (!res.data.ok) throw new Error(res.data.error?.message ?? 'Compare failed');
    return res.data.data;
  }

  async essay(draftText: string, school: string): Promise<unknown> {
    const res = await this.client.post<ApiResponse<unknown>>('/api/essay', { draftText, school });
    if (!res.data.ok) throw new Error(res.data.error?.message ?? 'Essay personalization failed');
    return res.data.data;
  }

  async scan(interactive = true): Promise<unknown> {
    const res = await this.client.post<ApiResponse<unknown>>('/api/scan', { interactive });
    if (!res.data.ok) throw new Error(res.data.error?.message ?? 'Scan failed');
    return res.data.data;
  }

  async checklist(school: string, deadline?: string): Promise<void> {
    const res = await this.client.post<ApiResponse<{ message: string }>>('/api/checklist', {
      school,
      deadline,
    });
    if (!res.data.ok) throw new Error(res.data.error?.message ?? 'Checklist creation failed');
  }

  async digest(): Promise<unknown> {
    const res = await this.client.post<ApiResponse<unknown>>('/api/digest');
    if (!res.data.ok) throw new Error(res.data.error?.message ?? 'Digest failed');
    return res.data.data;
  }

  async report(): Promise<unknown> {
    const res = await this.client.post<ApiResponse<unknown>>('/api/report');
    if (!res.data.ok) throw new Error(res.data.error?.message ?? 'Report failed');
    return res.data.data;
  }

  async getStatus(): Promise<void> {
    const res = await this.client.get<ApiResponse<{ message: string }>>('/api/status');
    if (!res.data.ok) throw new Error(res.data.error?.message ?? 'Status fetch failed');
  }

  async logInterest(
    title: string,
    field: string,
    source: string,
    strength?: number,
    notes?: string,
    url?: string,
  ): Promise<void> {
    const res = await this.client.post<ApiResponse<{ message: string }>>('/api/interests/log', {
      title,
      field,
      source,
      strength,
      notes,
      url,
    });
    if (!res.data.ok) throw new Error(res.data.error?.message ?? 'Interest log failed');
  }

  async analyzeInterests(): Promise<void> {
    const res = await this.client.post<ApiResponse<{ message: string }>>('/api/interests/analyze');
    if (!res.data.ok) throw new Error(res.data.error?.message ?? 'Interest analysis failed');
  }

  async confirm(school: string, status: string): Promise<boolean> {
    const res = await this.client.post<ApiResponse<{ updated: boolean }>>('/api/confirm', {
      school,
      status,
    });
    if (!res.data.ok) throw new Error(res.data.error?.message ?? 'Confirmation failed');
    return res.data.data?.updated ?? false;
  }

  async postSubmit(school: string, eventType: string, details?: string): Promise<void> {
    const res = await this.client.post<ApiResponse<{ message: string }>>('/api/post-submit', {
      school,
      eventType,
      details,
    });
    if (!res.data.ok) throw new Error(res.data.error?.message ?? 'Post-submit failed');
  }

  async archive(school: string): Promise<void> {
    const res = await this.client.post<ApiResponse<{ message: string }>>('/api/archive', {
      school,
    });
    if (!res.data.ok) throw new Error(res.data.error?.message ?? 'Archive failed');
  }

  async trackRecommendation(
    school: string,
    recommender: string,
    dueDate?: string,
    emailUrl?: string,
  ): Promise<void> {
    const res = await this.client.post<ApiResponse<{ message: string }>>('/api/recommendation', {
      school,
      recommender,
      dueDate,
      emailUrl,
    });
    if (!res.data.ok) throw new Error(res.data.error?.message ?? 'Recommendation tracking failed');
  }
}

export const apiClient = new UniApplyApiClient();
