import type { Capability, OrganizationRole, OrganizationType } from '@appsolo/shared';

const requestCapabilities: Capability[] = [
  'VIEW_CHANGE_REQUESTS',
  'SUBMIT_CHANGE_REQUESTS',
  'VIEW_ESTIMATES',
  'VIEW_COMMENTS',
  'CREATE_CLIENT_COMMENTS',
];
const internalCommentCapabilities: Capability[] = ['VIEW_INTERNAL_COMMENTS', 'CREATE_INTERNAL_COMMENTS'];
const estimateManagementCapabilities: Capability[] = ['MANAGE_ESTIMATES'];
const estimateResponseCapabilities: Capability[] = ['RESPOND_TO_ESTIMATES'];
const administrationCapabilities: Capability[] = [
  'VIEW_MEMBERS',
  'MANAGE_INVITATIONS',
  'MANAGE_MEMBERSHIPS',
  'VIEW_ACCESS_EVENTS',
];
const historyCapabilities: Capability[] = ['VIEW_REQUEST_HISTORY'];
const internalWorkCapabilities: Capability[] = [
  'VIEW_PRIVATE_TIME',
  'CREATE_PRIVATE_TIME',
  'VOID_OWN_PRIVATE_TIME',
  'MANAGE_REQUEST_WORK',
];
const privateTimeManagementCapabilities: Capability[] = ['MANAGE_PRIVATE_TIME'];
const workReviewCapabilities: Capability[] = ['RESPOND_TO_WORK_REVIEW'];
const cancellationCapabilities: Capability[] = ['CANCEL_REQUESTS'];

export function capabilitiesForRole(role: OrganizationRole): Capability[] {
  if (role === 'OWNER' || role === 'ADMIN')
    return [
      ...requestCapabilities,
      ...internalCommentCapabilities,
      ...estimateManagementCapabilities,
      ...administrationCapabilities,
      ...historyCapabilities,
      ...internalWorkCapabilities,
      ...privateTimeManagementCapabilities,
      ...cancellationCapabilities,
    ];
  if (role === 'DEVELOPER')
    return [
      ...requestCapabilities,
      ...internalCommentCapabilities,
      ...estimateManagementCapabilities,
      ...historyCapabilities,
      ...internalWorkCapabilities,
    ];
  if (role === 'CLIENT_ADMIN')
    return [
      ...requestCapabilities,
      ...estimateResponseCapabilities,
      ...administrationCapabilities,
      ...historyCapabilities,
      ...workReviewCapabilities,
      ...cancellationCapabilities,
    ];
  return [...requestCapabilities, ...historyCapabilities];
}

const assignableRoles: Record<OrganizationRole, readonly OrganizationRole[]> = {
  OWNER: ['OWNER', 'ADMIN', 'DEVELOPER', 'CLIENT_ADMIN', 'CLIENT_MEMBER'],
  ADMIN: ['DEVELOPER', 'CLIENT_ADMIN', 'CLIENT_MEMBER'],
  CLIENT_ADMIN: ['CLIENT_MEMBER'],
  DEVELOPER: [],
  CLIENT_MEMBER: [],
};

export function canAssignRole(actorRole: OrganizationRole, targetRole: OrganizationRole): boolean {
  return assignableRoles[actorRole].includes(targetRole);
}

export function isRoleAllowedForOrganization(
  organizationType: OrganizationType,
  role: OrganizationRole,
): boolean {
  return organizationType === 'CLIENT' ? true : role === 'OWNER' || role === 'ADMIN' || role === 'DEVELOPER';
}

export function hasCapability(role: OrganizationRole, capability: Capability): boolean {
  return capabilitiesForRole(role).includes(capability);
}
