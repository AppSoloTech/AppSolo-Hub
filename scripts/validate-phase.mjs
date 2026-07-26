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

  try {
    const qa = await readFile(path.join(noteDir, 'qa.md'), 'utf8');
    if (!qa.includes('> Status: Passed.')) errors.push('qa.md does not record a passed status.');
    if (!qa.includes('Required QA complete: Yes.'))
      errors.push('qa.md does not record required QA as complete.');
    if (!qa.includes('Human acceptance: Passed'))
      errors.push('qa.md does not record passing human acceptance.');
  } catch {
    // Missing file already reported.
  }

  try {
    const review = await readFile(path.join(noteDir, 'claude-review.md'), 'utf8');
    if (!/`ready(?: with non-blocking observations)?`/i.test(review)) {
      errors.push('claude-review.md does not contain a ready verdict.');
    }
  } catch {
    // Missing file already reported.
  }

  try {
    const disposition = await readFile(path.join(noteDir, 'review-disposition.md'), 'utf8');
    const findingRows = disposition
      .split('\n')
      .filter((line) => /^\|\s*(?:(?:C|R)\d+|P\d{3}-F\d+)\s*\|/.test(line))
      .map((line) => line.split('|').map((cell) => cell.trim()));
    const allowedDispositions = new Set(['Accepted', 'Rejected', 'Deferred', 'Clarification required']);
    if (findingRows.length === 0) errors.push('review-disposition.md contains no finding dispositions.');
    for (const row of findingRows) {
      if (!allowedDispositions.has(row[3])) {
        errors.push(`review-disposition.md has an unresolved disposition for ${row[1]}.`);
      }
    }
  } catch {
    // Missing file already reported.
  }
}

if (errors.length > 0) {
  console.error(`${phaseId} validation failed:\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`${phaseId} phase structure is valid${completion ? ' for completion review' : ''}.`);
