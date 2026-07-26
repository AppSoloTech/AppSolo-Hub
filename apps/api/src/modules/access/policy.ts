import type { Capability, OrganizationRole, OrganizationType } from '@appsolo/shared';

const requestCapabilities: Capability[] = ['VIEW_CHANGE_REQUESTS', 'SUBMIT_CHANGE_REQUESTS'];
const administrationCapabilities: Capability[] = [
  'VIEW_MEMBERS',
  'MANAGE_INVITATIONS',
  'MANAGE_MEMBERSHIPS',
  'VIEW_ACCESS_EVENTS',
];

export function capabilitiesForRole(role: OrganizationRole): Capability[] {
  if (role === 'OWNER' || role === 'ADMIN' || role === 'CLIENT_ADMIN') {
    return [...requestCapabilities, ...administrationCapabilities];
  }
  return [...requestCapabilities];
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
