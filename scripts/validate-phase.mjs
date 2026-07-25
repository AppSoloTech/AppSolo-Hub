#!/usr/bin/env node

import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const phaseId = process.argv.find((arg) => /^P\d{3}$/.test(arg));
const completion = process.argv.includes('--completion');

if (!phaseId) {
  console.error('Usage: node scripts/validate-phase.mjs P001 [--completion]');
  process.exit(2);
}

const root = process.cwd();
const phaseDir = path.join(root, 'markdown', 'phases');
const matches = (await readdir(phaseDir)).filter(
  (file) => file.startsWith(`${phaseId}-`) && file.endsWith('.md'),
);

if (matches.length !== 1) {
  console.error(`Expected one phase record for ${phaseId}, found ${matches.length}.`);
  process.exit(1);
}

const phasePath = path.join(phaseDir, matches[0]);
const phaseText = await readFile(phasePath, 'utf8');
const requiredNoteNames = ['implementation-handoff.md', 'claude-review.md', 'review-disposition.md', 'qa.md'];
const noteDir = path.join(root, 'notes', phaseId);
const errors = [];

for (const name of requiredNoteNames) {
  try {
    await access(path.join(noteDir, name));
  } catch {
    errors.push(`Missing notes/${phaseId}/${name}`);
  }
}

if (!phaseText.includes(`id: ${phaseId}`)) errors.push('Phase frontmatter ID does not match filename.');
if (!phaseText.includes('## Completion Gate')) errors.push('Phase record lacks Completion Gate section.');

if (completion) {
  if (!phaseText.includes('status: complete')) errors.push('Phase status is not complete.');
  for (const forbidden of ['base_sha: null', 'candidate_sha: null']) {
    if (phaseText.includes(forbidden)) errors.push(`Completion cannot retain ${forbidden}.`);
  }

  for (const name of requiredNoteNames) {
    try {
      const text = await readFile(path.join(noteDir, name), 'utf8');
      if (/\bPending\b|Not run|not reviewed|review not started/i.test(text)) {
        errors.push(`${name} still contains pending or unrun evidence.`);
      }
    } catch {
      // Missing file already reported.
    }
  }
}

if (errors.length > 0) {
  console.error(`${phaseId} validation failed:\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`${phaseId} phase structure is valid${completion ? ' for completion review' : ''}.`);
