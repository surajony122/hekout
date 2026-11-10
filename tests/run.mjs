// `npm test`: builds the app, starts a throwaway Postgres, applies the migrations, runs the
// real app in this process with Shopify, Razorpay and Twilio faked, then runs every
// tests/*.test.mjs file against it.
//
//   npm test                       everything
//   npm test -- pricing            only files whose name contains "pricing"
//   TEST_SKIP_BUILD=1 npm test     reuse the last build (only after changing tests)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import { DIST_DIR, ROOT, TEST_ENV, startApp, stopApp } from './helpers/app.mjs';
import { startPostgres } from './helpers/postgres.mjs';

const filters = process.argv.slice(2);
const testDir = path.join(ROOT, 'tests');
const files = fs.readdirSync(testDir)
  .filter((name) => name.endsWith('.test.mjs'))
  .filter((name) => filters.length === 0 || filters.some((filter) => name.includes(filter)))
  .sort()
  .map((name) => path.join(testDir, name));

if (files.length === 0) {
  console.error(`No test files match: ${filters.join(', ')}`);
  process.exit(1);
}

function step(label, command, args, env) {
  const started = Date.now();
  const result = spawnSync(command, args, { cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`\n✖ ${label} failed\n${result.stdout}\n${result.stderr}`);
    process.exit(1);
  }
  console.log(`✔ ${label} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const buildEnv = { ...TEST_ENV, NODE_ENV: 'production' };

step('Prisma client generated', npx, ['prisma', 'generate'], buildEnv);
if (process.env.TEST_SKIP_BUILD === '1' && fs.existsSync(path.join(ROOT, DIST_DIR, 'BUILD_ID'))) {
  console.log('• Reusing the last test build (TEST_SKIP_BUILD=1)');
} else {
  step('App built', npx, ['next', 'build'], buildEnv);
}

// With isolation 'none' the runner only ends when the process is about to exit, which never
// happens while the app is serving. So the run is over once every top-level test has finished.
function runTests(testFiles) {
  const stream = run({ files: testFiles, isolation: 'none', concurrency: false, timeout: 60_000 });
  stream.compose(spec).pipe(process.stdout);
  const results = { passed: 0, todo: 0, skipped: 0, failures: [] };
  let queued = 0;
  let finishedTop = 0;
  let idleTimer;
  return new Promise((resolve) => {
    const checkDone = () => {
      clearTimeout(idleTimer);
      if (queued > 0 && finishedTop === queued) idleTimer = setTimeout(() => resolve(results), 500);
    };
    stream.on('test:enqueue', (data) => { if (data.nesting === 0) { queued += 1; clearTimeout(idleTimer); } });
    stream.on('test:complete', (data) => { if (data.nesting === 0) { finishedTop += 1; checkDone(); } });
    stream.on('test:pass', (data) => {
      if (data.details.type === 'suite') return;
      if (data.todo) results.todo += 1;
      else if (data.skip) results.skipped += 1;
      else results.passed += 1;
    });
    stream.on('test:fail', (data) => {
      if (data.todo) { results.todo += 1; return; }
      const error = data.details.error;
      // A suite fails when a test inside it does, which is already counted.
      if (data.details.type === 'suite' && error?.failureType === 'subtestsFailed') return;
      const cause = error?.cause ?? error;
      results.failures.push({
        name: `${data.name} (${data.file ? path.relative(ROOT, data.file) : ''}:${data.line ?? ''})`,
        message: String(cause?.stack ?? cause?.message ?? cause).split('\n').slice(0, 12).join('\n'),
      });
    });
  });
}

const postgres = await startPostgres();
let exitCode = 1;
try {
  console.log('✔ Postgres started');
  step('Migrations applied', npx, ['prisma', 'migrate', 'deploy'], { DATABASE_URL: postgres.url });

  // The app logs expected errors (bad signatures, failed payments). Keep them out of the
  // results unless asked for.
  const verbose = process.env.TEST_VERBOSE === '1';
  const originalError = console.error;
  const originalLog = console.log;
  if (!verbose) {
    console.error = () => {};
    console.log = () => {};
  }

  await startApp(postgres.url);
  originalLog('✔ App started\n');

  const results = await runTests(files);
  exitCode = results.failures.length === 0 ? 0 : 1;

  for (const failure of results.failures) {
    process.stdout.write(`\n✖ ${failure.name}\n${failure.message}\n`);
  }
  process.stdout.write(`\n${results.passed} passed, ${results.failures.length} failed, ${results.todo} todo, ${results.skipped} skipped\n`);

  console.error = originalError;
  console.log = originalLog;
} catch (error) {
  console.error(error);
} finally {
  await stopApp().catch(() => {});
  await postgres.stop();
}
// Postgres is already stopped, so its library's warning about skipped exit hooks doesn't apply.
console.error = () => {};
process.exit(exitCode);
