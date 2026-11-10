// A throwaway Postgres for one test run. It lives in a temp folder and is deleted afterwards.
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

export async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

export async function startPostgres() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'checkoutflow-test-pg-'));
  const port = await freePort();
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'test',
    password: 'test',
    port,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('checkoutflow_test');
  return {
    url: `postgresql://test:test@127.0.0.1:${port}/checkoutflow_test`,
    async stop() {
      await pg.stop().catch(() => {});
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
