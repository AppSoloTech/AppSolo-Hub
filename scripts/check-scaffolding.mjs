#!/usr/bin/env node

import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const requiredFiles = [
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
  '.gitignore',
  '.editorconfig',
  'markdown/README.md',
  'markdown/ARCHITECTURE.md',
  'markdown/PRODUCT_VISION.md',
  'markdown/PRODUCT_AUDIT.md',
  'markdown/CURRENT_STATE.md',
  'markdown/ROADMAP.md',
  'markdown/PHASE_INDEX.md',
  'markdown/FLOW.md',
  'markdown/REVIEW_CHECKLIST.md',
  'markdown/TESTING.md',
  'markdown/contracts/API.md',
  'markdown/contracts/DATA_MODEL.md',
  'markdown/contracts/ENVIRONMENT.md',
  'markdown/contracts/INTEGRATIONS.md',
  'markdown/contracts/DEPLOYMENT.md',
  'markdown/contracts/SECURITY.md',
  'prompts/README.md',
  'prompts/PHASE_TEMPLATE.md',
  'notes/P001/implementation-handoff.md',
  'notes/P001/claude-review.md',
  'notes/P001/review-disposition.md',
  'notes/P001/qa.md',
];

const allowedStatuses = new Set([
  'draft',
  'approved',
  'implementing',
  'review_pending',
  'changes_requested',
  'reviewed',
  'qa_pending',
  'complete',
  'blocked',
  'deferred',
  'superseded',
  'cancelled',
]);

function parseFrontmatter(contents, file) {
  if (!contents.startsWith('---\n')) throw new Error(`${file}: missing frontmatter`);
  const end = contents.indexOf('\n---\n', 4);
  if (end === -1) throw new Error(`${file}: unterminated frontmatter`);
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

const errors = [];
for (const relative of requiredFiles) {
  try {
    await access(path.join(root, relative));
  } catch {
    errors.push(`Missing required file: ${relative}`);
  }
}

const phaseDir = path.join(root, 'markdown', 'phases');
const phaseFiles = (await readdir(phaseDir)).filter((file) => /^P\d{3}-.+\.md$/.test(file));
const ids = new Set();

for (const file of phaseFiles) {
  const relative = path.join('markdown', 'phases', file);
  const contents = await readFile(path.join(root, relative), 'utf8');
  let metadata;
  try {
    metadata = parseFrontmatter(contents, relative);
  } catch (error) {
    errors.push(error.message);
    continue;
  }

  for (const key of [
    'id',
    'title',
    'status',
    'owner',
    'reviewer',
    'depends_on',
    'base_branch',
    'base_sha',
    'candidate_sha',
    'risk',
    'human_qa_required',
  ]) {
    if (!(key in metadata)) errors.push(`${relative}: missing ${key}`);
  }

  if (ids.has(metadata.id)) errors.push(`${relative}: duplicate phase ID ${metadata.id}`);
  ids.add(metadata.id);

  if (!allowedStatuses.has(metadata.status)) {
    errors.push(`${relative}: invalid status ${metadata.status}`);
  }

  const needsPrompt = ['approved', 'implementing', 'review_pending', 'changes_requested', 'reviewed', 'qa_pending', 'complete'].includes(
    metadata.status,
  );
  if (needsPrompt && !metadata.prompt) {
    errors.push(`${relative}: ${metadata.status} phase must reference a prompt`);
  }
  if (metadata.prompt) {
    try {
      await access(path.join(root, metadata.prompt));
    } catch {
      errors.push(`${relative}: prompt does not exist: ${metadata.prompt}`);
    }
  }
}

if (!ids.has('P001')) errors.push('P001 phase record is missing.');

if (errors.length > 0) {
  console.error('Scaffolding validation failed:\n');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Scaffolding is valid: ${requiredFiles.length} required files and ${phaseFiles.length} phase records.`);
