import type { MarketProfile } from "@/config/markets";
import { type CalendarDate, compareDates, daysBetween, addDays } from "@/shared/dates/calendar";

// What a business has coming up because of how it is registered: the returns
// its tax registration obliges it to file (market.registration.filings) and
// the day its business name registration lapses. Pure: callers pass the
// business's own "today".

type RegistrationConfig = NonNullable<MarketProfile["registration"]>;

export type DeadlineProfile = {
  taxRegistration: string | null;
  taxpayerType: string | null;
  incomeTaxOption: string | null;
  /** Returns for periods that ended before this day aren't due. */
  taxRegisteredOn: CalendarDate | null;
  nameRegistrationAuthority: string | null;
  nameRegistrationValidUntil: CalendarDate | null;
};

export type Deadline = {
  /** Stable for a deadline: "2550Q:2026-10-25". */
  id: string;
  kind: "filing" | "renewal";
  /** The return's form number, or null for a renewal. */
  form: string | null;
  name: string;
  dueOn: CalendarDate;
  /** The day the period the return covers ends, or null for a renewal. */
  periodEnd: CalendarDate | null;
  /** Whole days from today; negative once it has passed (a lapsed registration). */
  daysLeft: number;
};

const iso = (year: number, month: number, day: number) =>
  `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export const DEADLINE_HORIZON_DAYS = 366;

/** Whether a business has what it takes to know its returns: its registration and, for individuals, its type. */
export function filingsKnown(config: RegistrationConfig, profile: Pick<DeadlineProfile, "taxRegistration" | "taxpayerType">): boolean {
  if (!profile.taxRegistration) return false;
  const needsType = config.filings.some((f) => f.taxpayerTypes && matchesRegistration(f.registrations, profile.taxRegistration));
  return !needsType || profile.taxpayerType !== null;
}

const matchesRegistration = (list: readonly string[] | undefined, value: string | null) =>
  !list || (value !== null && list.includes(value));

/**
 * The next deadlines, soonest first: returns due within a year, plus a name
 * registration that lapses within a year or already has. A registration that
 * hasn't been set gets no returns.
 */
export function upcomingDeadlines(
  config: RegistrationConfig,
  profile: DeadlineProfile,
  today: CalendarDate,
  { limit = 8 }: { limit?: number } = {},
): Deadline[] {
  const result: Deadline[] = [];
  const year = Number(today.slice(0, 4));
  const horizon = addDays(today, DEADLINE_HORIZON_DAYS);

  if (profile.taxRegistration) {
    for (const filing of config.filings) {
      if (!matchesRegistration(filing.registrations, profile.taxRegistration)) continue;
      if (filing.taxpayerTypes && (profile.taxpayerType === null || !filing.taxpayerTypes.includes(profile.taxpayerType))) continue;
      if (profile.incomeTaxOption && filing.exceptIncomeTaxOptions?.includes(profile.incomeTaxOption)) continue;

      for (const y of [year, year + 1]) {
        for (const o of filing.occurrences) {
          const dueOn = iso(y, o.month, o.day);
          if (compareDates(dueOn, today) < 0 || compareDates(dueOn, horizon) > 0) continue;
          const periodEnd = iso(y - o.periodEnd.yearsBack, o.periodEnd.month, o.periodEnd.day);
          if (profile.taxRegisteredOn && compareDates(periodEnd, profile.taxRegisteredOn) < 0) continue;
          result.push({
            id: `${filing.form}:${dueOn}`,
            kind: "filing",
            form: filing.form,
            name: filing.name,
            dueOn,
            periodEnd,
            daysLeft: daysBetween(today, dueOn),
          });
        }
      }
    }
  }

  const authority = config.nameRegistration.authorities.find((a) => a.code === profile.nameRegistrationAuthority);
  const until = profile.nameRegistrationValidUntil;
  if (authority?.expires && until && compareDates(until, horizon) <= 0) {
    result.push({
      id: `name-registration:${until}`,
      kind: "renewal",
      form: null,
      name: `${authority.label.split(" ")[0]} business name registration expires`,
      dueOn: until,
      periodEnd: null,
      daysLeft: daysBetween(today, until),
    });
  }

  return result
    .sort((a, b) => compareDates(a.dueOn, b.dueOn) || (a.form ?? "").localeCompare(b.form ?? ""))
    .slice(0, limit);
}
