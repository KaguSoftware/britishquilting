import { describe, expect, it } from "vitest";
import { birthdayEligibility, birthdayIn, birthdayOfferLabel, birthdayWindow, daysUntilBirthday, isBirthday, type BirthdaySettings } from "./birthday";
import { discountAmount } from "./pricing";

const settings: BirthdaySettings = { birthday_enabled: true, birthday_kind: "percent", birthday_value: 15, birthday_days: 14, birthday_min_subtotal_pence: 0 };

describe("birthday dates", () => {
  it("celebrates 29 February on 28 February in other years", () => {
    expect(birthdayIn("1996-02-29", 2027)).toBe("2027-02-28");
    expect(birthdayIn("1996-02-29", 2028)).toBe("2028-02-29");
    expect(isBirthday("1996-02-29", "2027-02-28")).toBe(true);
  });

  it("finds the window today falls in, counting the birthday as day one", () => {
    expect(birthdayWindow("1990-06-10", "2026-06-10", 14)).toEqual({ year: 2026, start: "2026-06-10", end: "2026-06-23" });
    expect(birthdayWindow("1990-06-10", "2026-06-23", 14)?.year).toBe(2026);
    expect(birthdayWindow("1990-06-10", "2026-06-24", 14)).toBeNull();
    expect(birthdayWindow("1990-06-10", "2026-06-09", 14)).toBeNull();
  });

  it("runs a late-December window over New Year as last year's birthday", () => {
    expect(birthdayWindow("1985-12-28", "2027-01-05", 14)).toEqual({ year: 2026, start: "2026-12-28", end: "2027-01-10" });
  });

  it("counts the days to the next birthday", () => {
    expect(daysUntilBirthday("1990-11-21", "2026-11-21")).toBe(0);
    expect(daysUntilBirthday("1990-11-20", "2026-11-21")).toBe(364);
  });
});

describe("birthday eligibility", () => {
  const base = { settings, dob: "1990-06-10", dobChangedAt: null, today: "2026-06-12", usedYears: [] as number[] };

  it("applies within the window", () => {
    expect(birthdayEligibility(base)).toEqual({ year: 2026, end: "2026-06-23" });
  });

  it("applies once per birthday year", () => {
    expect(birthdayEligibility({ ...base, usedYears: [2026] })).toBeNull();
    expect(birthdayEligibility({ ...base, usedYears: [2025] })).not.toBeNull();
  });

  it("doesn't apply when switched off, with no birthday, or with nothing off", () => {
    expect(birthdayEligibility({ ...base, settings: { ...settings, birthday_enabled: false } })).toBeNull();
    expect(birthdayEligibility({ ...base, dob: null })).toBeNull();
    expect(birthdayEligibility({ ...base, settings: { ...settings, birthday_value: 0 } })).toBeNull();
  });

  it("waits 60 days after a birthday is changed", () => {
    expect(birthdayEligibility({ ...base, dobChangedAt: "2026-05-01T09:00:00Z" })).toBeNull();
    expect(birthdayEligibility({ ...base, dobChangedAt: "2026-04-01T09:00:00Z" })).not.toBeNull();
  });
});

describe("birthday offer", () => {
  it("labels percent and fixed offers", () => {
    expect(birthdayOfferLabel(settings)).toBe("15% off");
    expect(birthdayOfferLabel({ birthday_kind: "fixed", birthday_value: 1000 })).toBe("£10 off");
    expect(birthdayOfferLabel({ birthday_kind: "fixed", birthday_value: 750 })).toBe("£7.50 off");
  });

  it("is worked out like any other discount", () => {
    expect(discountAmount({ code: "x", kind: "percent", value: 15, min_subtotal_pence: 0 }, 10000)).toBe(1500);
  });
});
