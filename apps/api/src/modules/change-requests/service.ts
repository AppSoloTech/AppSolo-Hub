import type { ChangeRequestDto, CreateChangeRequestInput } from '@appsolo/shared';
import { AppError } from '../../errors.js';
import { ChangeRequestRepository, type ProjectScope } from './repository.js';
const asDto = (row: { id: string; projectId: string; submittedByUserId: string; title: string; description: string; priority: ChangeRequestDto['priority']; status: ChangeRequestDto['status']; requestedCompletionDate: string | null; createdAt: Date; updatedAt: Date }): ChangeRequestDto => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
export class ChangeRequestService {
  constructor(private readonly repository: ChangeRequestRepository) {}
  private async authorizeProject(projectId: string, userId: string): Promise<ProjectScope> { const scope = await this.repository.findProjectScope(projectId, userId); if (!scope) throw new AppError('FORBIDDEN', 403, 'You do not have access to this project.'); return scope; }
  async list(projectId: string, userId: string, limit: number, offset: number) { const scope = await this.authorizeProject(projectId, userId); const rows = await this.repository.list(scope, limit, offset); return { data: rows.map(asDto), meta: { count: rows.length, limit, offset } }; }
  async detail(id: string, userId: string) { const projectRow = await this.repository.findRequestProject(id); const projectId = projectRow[0]?.projectId; if (!projectId) throw new AppError('NOT_FOUND', 404, 'The requested resource was not found.'); const scope = await this.authorizeProject(projectId, userId); const row = await this.repository.findById(scope, id); if (!row) throw new AppError('NOT_FOUND', 404, 'The requested resource was not found.'); return { data: asDto(row), meta: {} }; }
  async create(projectId: string, userId: string, input: CreateChangeRequestInput) { const scope = await this.authorizeProject(projectId, userId); return { data: asDto(await this.repository.create(scope, userId, input)), meta: {} }; }
}
