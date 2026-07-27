#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import prettier from 'prettier';

const root = process.cwd();
const phasesDir = path.join(root, 'markdown', 'phases');
const outputPath = path.join(root, 'markdown', 'PHASE_INDEX.md');
const checkOnly = process.argv.includes('--check');

function parseFrontmatter(contents, file) {
  if (!contents.startsWith('---\n')) {
    throw new Error(`${file}: missing YAML frontmatter`);
  }

  const end = contents.indexOf('\n---\n', 4);
  if (end === -1) {
    throw new Error(`${file}: unterminated YAML frontmatter`);
  }

  const metadata = {};
  for (const line of contents.slice(4, end).split('\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (value === 'null') value = null;
    metadata[key] = value;
  }
  return metadata;
}

const files = (await readdir(phasesDir)).filter((file) => /^P\d{3}-.+\.md$/.test(file)).sort();

const phases = [];
for (const file of files) {
  const contents = await readFile(path.join(phasesDir, file), 'utf8');
  const metadata = parseFrontmatter(contents, file);
  phases.push({ ...metadata, file });
}

const lines = [
  '# Phase Index',
  '',
  '> Generated from `markdown/phases/*.md` by `node scripts/generate-phase-index.mjs`.',
  '> Do not edit phase status here; edit the canonical phase record and regenerate.',
  '',
  '| Phase | Title | Status | Risk | Depends On | Prompt |',
  '| --- | --- | --- | --- | --- | --- |',
];

for (const phase of phases) {
  const phaseLink = `[${phase.id}](phases/${phase.file})`;
  const prompt = phase.prompt
    ? `[active prompt](../${phase.prompt})`
    : phase.draft_prompt
      ? `[draft prompt](../${phase.draft_prompt})`
      : 'Not drafted';
  lines.push(
    `| ${phaseLink} | ${phase.title ?? ''} | \`${phase.status ?? ''}\` | ${phase.risk ?? ''} | ${phase.depends_on ?? '[]'} | ${prompt} |`,
  );
}

lines.push('', '## Active Work', '');
const active = phases.filter((phase) =>
  [
    'approved',
    'implementing',
    'review_pending',
    'changes_requested',
    'reviewed',
    'qa_pending',
    'blocked',
  ].includes(phase.status),
);

if (active.length === 0) {
  lines.push('No active phase.');
} else {
  for (const phase of active) {
    lines.push(`- **${phase.id} — ${phase.title}**: \`${phase.status}\`.`);
  }
}

const generated = await prettier.format(`${lines.join('\n')}\n`, {
  filepath: outputPath,
});

if (checkOnly) {
  let existing;
  try {
    existing = await readFile(outputPath, 'utf8');
  } catch {
    console.error('PHASE_INDEX.md is missing. Run the generator without --check.');
    process.exit(1);
  }

  if (existing !== generated) {
    console.error('PHASE_INDEX.md is stale. Run: node scripts/generate-phase-index.mjs');
    process.exit(1);
  }

  console.log('PHASE_INDEX.md is current.');
} else {
  await writeFile(outputPath, generated, 'utf8');
  console.log(`Generated ${path.relative(root, outputPath)} for ${phases.length} phases.`);
}
