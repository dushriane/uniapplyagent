import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..');
const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function runCliHelp(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    npxBin,
    ['ts-node', 'src/cli.ts', ...args, '--help'],
    {
      cwd: repoRoot,
      encoding: 'utf-8',
      env: { ...process.env, FORCE_COLOR: '0' },
    },
  );

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

const criticalCommands = ['setup', 'compare', 'status', 'report'];

for (const command of criticalCommands) {
  test(`cli smoke help for ${command}`, () => {
    const result = runCliHelp([command]);

    assert.equal(
      result.status,
      0,
      `Expected zero exit code for "${command} --help". stderr: ${result.stderr}`,
    );

    const output = `${result.stdout}\n${result.stderr}`;
    assert.ok(
      output.toLowerCase().includes(command),
      `Expected help output to include command name "${command}". Output: ${output}`,
    );
  });
}
