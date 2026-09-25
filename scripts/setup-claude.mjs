#!/usr/bin/env node
// `yarn setup:claude` — points Claude Code at the tool-agnostic agent docs via two local, gitignored symlinks:
//   CLAUDE.md      -> AGENT.md           (Claude Code auto-loads CLAUDE.md)
//   .claude/skills -> ../.agent/skills   (Claude Code discovers project skills only under .claude/skills)
// AGENT.md and .agent/ stay the single source of truth. Safe to re-run.

import console from 'node:console';
import { existsSync, lstatSync, mkdirSync, readlinkSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const links = [
  { link: 'CLAUDE.md', target: 'AGENT.md', type: 'file' },
  { link: '.claude/skills', target: '../.agent/skills', type: 'dir' },
];

let failed = false;
for (const { link, target, type } of links) {
  const linkPath = path.join(ROOT, link);
  mkdirSync(path.dirname(linkPath), { recursive: true });

  let stat = null;
  try {
    stat = lstatSync(linkPath);
  } catch {
    // does not exist yet
  }

  const resolvedTarget = path.resolve(path.dirname(linkPath), target);
  if (
    stat?.isSymbolicLink() &&
    path.resolve(path.dirname(linkPath), readlinkSync(linkPath)) === resolvedTarget
  ) {
    console.log(`ok       ${link} -> ${target}`);
    continue;
  }
  if (stat) {
    console.error(
      `skipped  ${link} already exists and is not a link to ${target} — move it aside and re-run.`,
    );
    failed = true;
    continue;
  }
  if (!existsSync(resolvedTarget)) {
    console.error(`skipped  ${link}: target ${target} not found.`);
    failed = true;
    continue;
  }
  // 'junction' lets directory links work on Windows without admin rights; ignored elsewhere.
  symlinkSync(target, linkPath, type === 'dir' ? 'junction' : 'file');
  console.log(`created  ${link} -> ${target}`);
}

process.exit(failed ? 1 : 0);
