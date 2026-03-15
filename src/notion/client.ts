import { Client } from '@notionhq/client';
import { loadConfig } from '../config';

let _client: Client | null = null;

/** Returns a memoised Notion SDK client using the token from the environment. */
export function getNotionClient(): Client {
  if (!_client) {
    const { notionToken } = loadConfig();
    _client = new Client({ auth: notionToken });
  }
  return _client;
}

/** Reset the cached client — useful in tests or after token rotation. */
export function resetNotionClient(): void {
  _client = null;
}
