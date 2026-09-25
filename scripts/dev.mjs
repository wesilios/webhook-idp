#!/usr/bin/env node
// Local dev orchestrator — `yarn dev [app...]`.
//
// Starts every workspace package that defines a `start:dev` script (or only the named ones), prefixes each app's
// log lines with its name, and prints a status table: kind (http/worker), state, URL/port, Swagger UI, and pid.
// It also probes the MongoDB/RabbitMQ endpoints the apps are configured with, so a missing dependency shows up
// front instead of as a retry loop buried in the logs. Zero dependencies on purpose — plain Node built-ins only.
//
// While running: type `s` + Enter to reprint the status table, `q` + Enter (or Ctrl+C) to stop everything.

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline';
import { clearInterval, clearTimeout, setInterval, setTimeout } from 'node:timers';
import { URL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const READY_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 1_000;
const STOP_GRACE_MS = 8_000;

// ---------- terminal helpers ----------

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : String(text));
const c = {
  bold: paint('1'),
  dim: paint('2'),
  red: paint('31'),
  green: paint('32'),
  yellow: paint('33'),
  cyan: paint('36'),
};
const APP_COLORS = ['36', '35', '33', '34', '32', '96', '95', '93'];
// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;
// Screen-clearing sequences emitted by watch-mode compilers — stripped so one app can't wipe the others' output.
// eslint-disable-next-line no-control-regex
const CLEAR_SCREEN = /\x1bc|\x1b\[[23]J|\x1b\[H/g;
const visibleLength = (text) => String(text).replace(ANSI, '').length;
const padEnd = (text, width) => String(text) + ' '.repeat(Math.max(0, width - visibleLength(text)));

function log(message) {
  process.stdout.write(`${c.bold('[dev]')} ${message}\n`);
}

// ---------- discovery ----------

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function parseEnvFile(file) {
  const env = {};
  if (!existsSync(file)) return env;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

/** Resolves the root `workspaces` globs (only the `dir/*` form this repo uses) to package directories. */
function workspaceDirs() {
  const { workspaces = [] } = readJson(path.join(ROOT, 'package.json'));
  const patterns = Array.isArray(workspaces) ? workspaces : (workspaces.packages ?? []);
  const dirs = [];
  for (const pattern of patterns) {
    if (pattern.endsWith('/*')) {
      const base = path.join(ROOT, pattern.slice(0, -2));
      if (!existsSync(base)) continue;
      for (const entry of readdirSync(base, { withFileTypes: true })) {
        if (entry.isDirectory()) dirs.push(path.join(base, entry.name));
      }
    } else {
      dirs.push(path.join(ROOT, pattern));
    }
  }
  return dirs.filter((dir) => existsSync(path.join(dir, 'package.json')));
}

/**
 * Builds an app descriptor from a package. Kind/port/docs are inferred from the package's own files rather than a
 * separate manifest, so a new package shows up here with no extra config: it is an HTTP app if `src/main.ts` calls
 * `.listen(`, its port is `PORT` from the package's `.env` (falling back to `.env.example`, then Nest's 3000
 * default used by every `main.ts`), and its Swagger/global-prefix paths are read from `main.ts` too.
 */
function describeApp(dir, index) {
  const pkg = readJson(path.join(dir, 'package.json'));
  if (!pkg.scripts?.['start:dev']) return null;

  const hasEnv = existsSync(path.join(dir, '.env'));
  const env = parseEnvFile(path.join(dir, hasEnv ? '.env' : '.env.example'));
  const mainFile = path.join(dir, 'src', 'main.ts');
  const main = existsSync(mainFile) ? readFileSync(mainFile, 'utf8') : '';
  const isHttp = /\.listen\(/.test(main);
  const port = isHttp ? Number(env.PORT || 3000) : null;
  const docsPath = main.match(/SwaggerModule\.setup\(\s*['"`]\/?([^'"`]+)/)?.[1];
  const apiPrefix = main.match(/setGlobalPrefix\(\s*['"`]\/?([^'"`]+)/)?.[1];

  return {
    name: pkg.name,
    dir,
    env,
    hasEnv,
    kind: isHttp ? 'http' : 'worker',
    port,
    url: isHttp ? `http://localhost:${port}${apiPrefix ? `/${apiPrefix}` : ''}` : null,
    docsUrl: isHttp && docsPath ? `http://localhost:${port}/${docsPath}` : null,
    color: APP_COLORS[index % APP_COLORS.length],
    state: 'pending',
    pid: null,
    child: null,
  };
}

/** External endpoints the selected apps are configured to use, deduplicated by host:port. */
function collectDependencies(apps) {
  const known = [
    { key: 'MONGODB_URI', label: 'MongoDB', defaultPort: 27017 },
    { key: 'RABBIT_MQ_CONN', label: 'RabbitMQ', defaultPort: 5672 },
  ];
  const deps = new Map();
  for (const app of apps) {
    for (const { key, label, defaultPort } of known) {
      const value = app.env[key];
      if (!value) continue;
      let host = null;
      let port = null;
      try {
        const url = new URL(value);
        if (!url.protocol.includes('+srv')) {
          host = url.hostname.replace(/^\[|\]$/g, '');
          port = Number(url.port || defaultPort);
        }
      } catch {
        // multi-host or otherwise unparseable connection string — listed, but not probed
      }
      const id = host ? `${label}@${host}:${port}` : `${label}@${value}`;
      const existing = deps.get(id);
      if (existing) existing.usedBy.push(app.name);
      else
        deps.set(id, {
          label,
          host,
          port,
          target: host ? `${host}:${port}` : value,
          usedBy: [app.name],
        });
    }
  }
  return [...deps.values()];
}

// ---------- probing ----------

function canConnect(host, port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

// ---------- process management ----------

function pipeLines(stream, app) {
  const prefix = paint(app.color)(`${padEnd(app.name, labelWidth)} │`);
  const rl = readline.createInterface({ input: stream });
  rl.on('line', (line) => {
    const clean = line.replace(CLEAR_SCREEN, '');
    if (clean.trim() === '' && line !== clean) return;
    process.stdout.write(`${prefix} ${clean}\n`);
  });
}

function start(app) {
  // `--preserveWatchOutput` stops the Nest/tsc watcher from clearing the terminal on every rebuild.
  const child = spawn('yarn', ['--silent', 'run', 'start:dev', '--preserveWatchOutput'], {
    cwd: app.dir,
    env: { ...process.env, FORCE_COLOR: useColor ? '1' : '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
    // Own process group, so stopping reaches the whole yarn → nest → node chain, not just yarn.
    detached: process.platform !== 'win32',
  });
  app.child = child;
  app.pid = child.pid;
  setState(app, app.kind === 'http' ? 'starting' : 'running');
  pipeLines(child.stdout, app);
  pipeLines(child.stderr, app);
  child.on('exit', (code, signal) => {
    app.child = null;
    setState(app, stopping ? 'stopped' : `exited (${signal ?? code})`);
    if (!stopping && apps.every((a) => !a.child)) {
      log(c.red('every app has exited — shutting down.'));
      process.exit(1);
    }
  });
}

function signalApp(app, signal) {
  if (!app.child) return;
  try {
    if (process.platform === 'win32') app.child.kill(signal);
    else process.kill(-app.child.pid, signal);
  } catch {
    // already gone
  }
}

let stopping = false;
function stopAll(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  log('stopping all apps...');
  const running = apps.filter((a) => a.child);
  running.forEach((a) => signalApp(a, 'SIGINT'));
  const force = setTimeout(() => running.forEach((a) => signalApp(a, 'SIGKILL')), STOP_GRACE_MS);
  const check = setInterval(() => {
    if (apps.every((a) => !a.child)) {
      clearTimeout(force);
      clearInterval(check);
      printTable();
      process.exit(exitCode);
    }
  }, 200);
}

// ---------- status reporting ----------

const STATE_STYLE = {
  ready: c.green,
  running: c.green,
  starting: c.yellow,
  pending: c.dim,
  skipped: c.red,
  stopped: c.dim,
};

let initialReportDone = false;
function setState(app, state) {
  const previous = app.state;
  app.state = state;
  if (!initialReportDone || previous === state) return;
  const style = STATE_STYLE[state] ?? c.red;
  const where = app.url && state === 'ready' ? ` → ${app.url}` : '';
  log(`${paint(app.color)(app.name)} ${style(state)}${where}`);
}

function printTable() {
  const rows = apps.map((app) => [
    paint(app.color)(app.name),
    app.kind,
    (STATE_STYLE[app.state] ?? c.red)(app.state),
    app.url ?? c.dim(app.port ? `:${app.port}` : 'no HTTP listener'),
    app.docsUrl ?? c.dim('—'),
    app.pid ?? c.dim('—'),
  ]);
  const depRows = dependencies.map((dep) => [
    dep.label,
    dep.target,
    dep.reachable === undefined
      ? c.dim('not probed')
      : dep.reachable
        ? c.green('reachable')
        : c.red('unreachable'),
    dep.usedBy.join(', '),
  ]);
  const render = (headers, body) => {
    const widths = headers.map((h, i) =>
      Math.max(visibleLength(h), ...body.map((r) => visibleLength(r[i]))),
    );
    const line = (cells) => '  ' + cells.map((cell, i) => padEnd(cell, widths[i])).join('   ');
    return [c.bold(line(headers)), ...body.map(line)].join('\n');
  };
  const out = [
    '',
    c.bold('━━━ Apps ' + '━'.repeat(60)),
    render(['APP', 'KIND', 'STATE', 'ENDPOINT', 'SWAGGER', 'PID'], rows),
  ];
  if (depRows.length) {
    out.push('', c.bold('━━━ Dependencies ' + '━'.repeat(52)));
    out.push(render(['SERVICE', 'ADDRESS', 'STATUS', 'USED BY'], depRows));
    if (!stopping && dependencies.some((d) => d.reachable === false)) {
      out.push(
        '',
        c.yellow(
          '  Tip: start them however you run them locally (systemd, your own container, ...), or `yarn infra:up`.',
        ),
      );
    }
  }
  if (!stopping) out.push('', c.dim('  s + Enter: status   q + Enter / Ctrl+C: stop all'));
  out.push('');
  process.stdout.write(out.join('\n') + '\n');
}

async function watchHttpApps() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  // Keeps polling after startup too: a watch-mode rebuild briefly takes the port down, and that is reported.
  for (;;) {
    if (stopping) return;
    for (const app of apps) {
      if (app.kind !== 'http' || !app.child) continue;
      const up = await canConnect('localhost', app.port);
      if (up && app.state !== 'ready') setState(app, 'ready');
      else if (!up && app.state === 'ready') setState(app, 'starting');
    }
    const pending = apps.some((a) => a.kind === 'http' && a.child && a.state !== 'ready');
    if (!initialReportDone && (!pending || Date.now() > deadline)) {
      initialReportDone = true;
      printTable();
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

// ---------- main ----------

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) {
  process.stdout.write(
    'Usage: yarn dev [app...]\n\nStarts every workspace app with a `start:dev` script (or only the named ones).\n',
  );
  process.exit(0);
}

const discovered = workspaceDirs()
  .map((dir, i) => describeApp(dir, i))
  .filter(Boolean);
const unknown = args.filter((name) => !discovered.some((a) => a.name === name));
if (unknown.length) {
  log(
    c.red(
      `unknown app(s): ${unknown.join(', ')}. Available: ${discovered.map((a) => a.name).join(', ')}`,
    ),
  );
  process.exit(1);
}
const apps = args.length ? discovered.filter((a) => args.includes(a.name)) : discovered;
if (!apps.length) {
  log(c.red('no workspace package defines a `start:dev` script.'));
  process.exit(1);
}
const labelWidth = Math.max(...apps.map((a) => a.name.length));

// Two HTTP apps on one port would leave one of them crash-looping — fail before starting anything.
const byPort = Map.groupBy(
  apps.filter((a) => a.port),
  (a) => a.port,
);
const clashes = [...byPort].filter(([, list]) => list.length > 1);
if (clashes.length) {
  for (const [port, list] of clashes) {
    log(
      c.red(
        `port ${port} is configured for more than one app: ${list.map((a) => a.name).join(', ')}`,
      ),
    );
  }
  log('set a distinct PORT in each package .env and try again.');
  process.exit(1);
}

for (const app of apps.filter((a) => !a.hasEnv)) {
  log(
    c.yellow(
      `${app.name}: no .env found — using .env.example values (cp .env.example .env to customise).`,
    ),
  );
}

const dependencies = collectDependencies(apps);
await Promise.all(
  dependencies.map(async (dep) => {
    if (dep.host) dep.reachable = await canConnect(dep.host, dep.port);
  }),
);

for (const app of apps) {
  if (app.port && (await canConnect('localhost', app.port))) {
    app.state = 'skipped';
    log(c.red(`${app.name}: port ${app.port} is already in use — not starting it.`));
    continue;
  }
  start(app);
}
if (apps.every((a) => !a.child)) {
  printTable();
  process.exit(1);
}

log(
  `started ${apps
    .filter((a) => a.child)
    .map((a) => paint(a.color)(a.name))
    .join(', ')} — waiting for readiness...`,
);
process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

if (process.stdin.isTTY) {
  readline.createInterface({ input: process.stdin }).on('line', (line) => {
    const cmd = line.trim().toLowerCase();
    if (cmd === 's' || cmd === 'status') printTable();
    else if (cmd === 'q' || cmd === 'quit') stopAll(0);
  });
}

watchHttpApps();
