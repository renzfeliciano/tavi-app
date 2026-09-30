// Capability-based authorization (docs/foundation-proposal.md §E). Every
// decision goes through `can` / `assertCan`; never branch on role names
// elsewhere. The matrix is literal code on purpose: easy to review, diff and
// test, with no permissions database to drift.

export const ROLES = ["owner", "admin", "member"] as const;
export type Role = (typeof ROLES)[number];

export const CAPABILITIES = [
  "customers.read",
  "customers.write",
  "catalog.read",
  "catalog.write",
  "quotes.read",
  "quotes.write",
  "quotes.send",
  "quotes.decide",
  "invoices.read",
  "invoices.write",
  "invoices.send",
  "invoices.void",
  "payments.read",
  "payments.record",
  "payments.void",
  "organization.manage",
  "users.manage",
  "audit.read",
  "billing.manage",
  "organization.delete",
  "ownership.transfer",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const EVERYDAY: readonly Capability[] = [
  "customers.read",
  "customers.write",
  "catalog.read",
  "catalog.write",
  "quotes.read",
  "quotes.write",
  "quotes.send",
  "quotes.decide",
  "invoices.read",
  "invoices.write",
  "invoices.send",
  "payments.read",
];

const ADMINISTRATION: readonly Capability[] = [
  "invoices.void",
  "payments.record",
  "payments.void",
  "organization.manage",
  "users.manage",
  "audit.read",
];

const OWNERSHIP: readonly Capability[] = [
  "billing.manage",
  "organization.delete",
  "ownership.transfer",
];

const ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  owner: new Set([...EVERYDAY, ...ADMINISTRATION, ...OWNERSHIP]),
  admin: new Set([...EVERYDAY, ...ADMINISTRATION]),
  member: new Set(EVERYDAY),
};

export function capabilitiesFor(role: Role): ReadonlySet<Capability> {
  return ROLE_CAPABILITIES[role];
}

/** Anything that carries a role: the request's organization context. */
export type Actor = { role: Role };

export function can(actor: Actor, capability: Capability): boolean {
  return ROLE_CAPABILITIES[actor.role].has(capability);
}

export class ForbiddenError extends Error {
  readonly capability: Capability;
  constructor(capability: Capability) {
    super(`Not allowed: ${capability}`);
    this.name = "ForbiddenError";
    this.capability = capability;
  }
}

/** Throws ForbiddenError unless the actor holds the capability. */
export function assertCan(actor: Actor, capability: Capability): void {
  if (!can(actor, capability)) throw new ForbiddenError(capability);
}
