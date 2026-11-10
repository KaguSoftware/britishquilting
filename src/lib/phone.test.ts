import { describe, expect, it } from "vitest";
import { phoneProblem, trimNational } from "./phone";

describe("phoneProblem", () => {
  it("wants 10 digits after +90 for Turkey", () => {
    expect(phoneProblem("+90 532 123 45 67")).toBeNull();
    expect(phoneProblem("+90 532 123 45 6")).toMatch(/Turkey.*10 digits.*not 9/);
    expect(phoneProblem("+90 532 123 45 678")).toMatch(/not 11/);
  });
  it("accepts UK numbers of 10 digits and refuses 11", () => {
    expect(phoneProblem("+44 7785 367252")).toBeNull();
    expect(phoneProblem("+44 20088032002")).toMatch(/UK/);
  });
  it("uses the 15 digit international limit for unlisted countries", () => {
    expect(phoneProblem("+998 901234567")).toBeNull();
    expect(phoneProblem("+998 9012345678901234")).not.toBeNull();
  });
  it("keeps the loose check for numbers without a country code", () => {
    expect(phoneProblem("0567835156")).toBeNull();
    expect(phoneProblem("abc")).not.toBeNull();
    expect(phoneProblem("")).toBeNull();
  });
});

describe("trimNational", () => {
  it("stops at the country's limit and drops the leading 0", () => {
    expect(trimNational("90", "0532 123 45 67 89")).toBe("532 123 45 67");
    expect(trimNational("44", "07785 367252")).toBe("7785 367252");
    expect(trimNational("39", "0612 3456")).toBe("0612 3456");
  });
});
