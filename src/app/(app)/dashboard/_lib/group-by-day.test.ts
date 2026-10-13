import { describe, expect, it } from "vitest";
import { groupByDay } from "./group-by-day";

const at = (iso: string) => ({ createdAt: new Date(iso) });
const options = { today: "2026-10-12", timezone: "Asia/Manila", locale: "en-PH" };

describe("groupByDay", () => {
  it("puts today and yesterday in words and older days by date", () => {
    const groups = groupByDay(
      [at("2026-10-12T02:00:00Z"), at("2026-10-11T02:00:00Z"), at("2026-10-09T02:00:00Z")],
      options,
    );

    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday", "Oct 9, 2026"]);
    expect(groups.map((g) => g.day)).toEqual(["2026-10-12", "2026-10-11", "2026-10-09"]);
  });

  it("keeps several events of one day together, in the order given", () => {
    const first = at("2026-10-12T05:00:00Z");
    const second = at("2026-10-12T03:00:00Z");
    const [today] = groupByDay([first, second], options);

    expect(today?.items).toEqual([first, second]);
  });

  it("decides the day where the business is, not in UTC", () => {
    // 17:00 UTC on the 11th is 01:00 on the 12th in Manila.
    const [group] = groupByDay([at("2026-10-11T17:00:00Z")], options);

    expect(group?.day).toBe("2026-10-12");
    expect(group?.label).toBe("Today");
  });

  it("starts a new day at the business's midnight", () => {
    const groups = groupByDay([at("2026-10-11T16:00:00Z"), at("2026-10-11T15:59:00Z")], options);

    expect(groups.map((g) => g.day)).toEqual(["2026-10-12", "2026-10-11"]);
    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday"]);
  });

  it("words today and yesterday in the business's language", () => {
    const groups = groupByDay([at("2026-10-12T02:00:00Z"), at("2026-10-11T02:00:00Z")], {
      today: "2026-10-12",
      timezone: "Europe/Berlin",
      locale: "de-DE",
    });

    expect(groups.map((g) => g.label)).toEqual(["Heute", "Gestern"]);
  });

  it("has no groups when there is nothing to group", () => {
    expect(groupByDay([], options)).toEqual([]);
  });
});
