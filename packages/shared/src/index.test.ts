import { describe, expect, it } from 'vitest';
import { createChangeRequestSchema } from './index.js';

describe('createChangeRequestSchema', () => {
  it('normalizes a valid input and defaults priority', () => {
    expect(createChangeRequestSchema.parse({ title: '  Export CSV ', description: '  Please export our dashboard as CSV. ' })).toEqual({
      title: 'Export CSV', description: 'Please export our dashboard as CSV.', priority: 'NORMAL',
    });
  });
  it('rejects short fields, invalid dates, and unknown fields', () => {
    expect(() => createChangeRequestSchema.parse({ title: 'No', description: 'short', requestedCompletionDate: 'tomorrow', extra: true })).toThrow();
  });
});
