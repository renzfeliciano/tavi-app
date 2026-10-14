// The short status on a Settings row: what needs doing ("Add your TIN"), what is done ("Complete") or just a count
// ("3 rates"). Each takes only what it needs, so the page can feed it whatever the signed-in role may read.

export type RowState = { text: string; tone: "done" | "todo" | "info" };

const blank = (value: string | null | undefined) => !value || value.trim() === "";
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function businessProfileState(
  profile: { taxId: string | null; addressLine1: string | null; city: string | null },
  taxIdLabel: string,
): RowState {
  if (blank(profile.taxId)) return { text: `Add your ${taxIdLabel}`, tone: "todo" };
  if (blank(profile.addressLine1) || blank(profile.city)) return { text: "Add your address", tone: "todo" };
  return { text: "Complete", tone: "done" };
}

export function registrationState(registration: { taxpayerType: string | null }): RowState {
  return blank(registration.taxpayerType) ? { text: "Not set up", tone: "todo" } : { text: "Set up", tone: "done" };
}

export function taxRatesState(rates: { archivedAt: Date | null }[]): RowState {
  const inUse = rates.filter((rate) => rate.archivedAt === null).length;
  return inUse === 0 ? { text: "No rates yet", tone: "todo" } : { text: plural(inUse, "rate", "rates"), tone: "info" };
}

export function invoiceModeState(registration: { active: boolean } | null): RowState {
  return registration?.active ? { text: "On", tone: "done" } : { text: "Off", tone: "info" };
}

export function teamState(members: number, invited: number): RowState {
  const people = members <= 1 ? "Just you" : `${members} people`;
  return { text: invited > 0 ? `${people} · ${invited} invited` : people, tone: "info" };
}

export function devicesState(count: number): RowState {
  return { text: plural(count, "device", "devices"), tone: "info" };
}
