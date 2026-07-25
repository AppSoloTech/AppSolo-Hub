import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createChangeRequestSchema,
  type ChangeRequestDto,
  type CreateChangeRequestInput,
  type SuccessEnvelope,
} from '@appsolo/shared';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { z } from 'zod';
import { requestsApi } from '../../api.js';
import styles from './ChangeRequests.module.css';
type FormInput = z.input<typeof createChangeRequestSchema>;
export function NewChangeRequest() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const requestList = queryClient.getQueryData<SuccessEnvelope<ChangeRequestDto[]>>([
    'change-requests',
    projectId,
  ]);
  const { organizationName = 'Authorized organization', projectName = 'Project' } = (requestList?.meta ??
    {}) as {
    organizationName?: string;
    projectName?: string;
  };
  const form = useForm<FormInput, unknown, CreateChangeRequestInput>({
    resolver: zodResolver(createChangeRequestSchema),
    defaultValues: { priority: 'NORMAL' },
  });
  const mutation = useMutation({
    mutationFn: (input: CreateChangeRequestInput) => requestsApi.create(projectId, input),
    onSuccess: async ({ data }) => {
      await queryClient.invalidateQueries({ queryKey: ['change-requests', projectId] });
      void navigate(`/change-requests/${data.id}`, { state: { created: true } });
    },
  });
  return (
    <>
      <Link to={`/projects/${projectId}/change-requests`}>← Change requests</Link>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">
            {organizationName} · {projectName}
          </p>
          <h1>New change request</h1>
          <p>Describe the outcome you need. You can add estimates and discussion later.</p>
        </div>
      </header>
      {mutation.isError && (
        <p className="error" role="alert">
          We could not save this request. Please try again.
        </p>
      )}
      <form
        className={`card ${styles.form}`}
        onSubmit={(event) => {
          void form.handleSubmit((input) => {
            mutation.mutate(input);
          })(event);
        }}
        noValidate
      >
        <label>
          Title
          <input aria-invalid={Boolean(form.formState.errors.title)} {...form.register('title')} />
        </label>
        {form.formState.errors.title && (
          <p className="error" role="alert">
            {form.formState.errors.title.message}
          </p>
        )}
        <label>
          Description
          <textarea
            rows={7}
            aria-invalid={Boolean(form.formState.errors.description)}
            {...form.register('description')}
          />
        </label>
        {form.formState.errors.description && (
          <p className="error" role="alert">
            {form.formState.errors.description.message}
          </p>
        )}
        <div className={styles.fields}>
          <label>
            Priority
            <select {...form.register('priority')}>
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </label>
          <label>
            Requested completion (optional)
            <input
              type="date"
              {...form.register('requestedCompletionDate', {
                setValueAs: (value: string) => value || undefined,
              })}
            />
          </label>
        </div>
        <button className="button" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving request…' : 'Submit request'}
        </button>
      </form>
    </>
  );
}
