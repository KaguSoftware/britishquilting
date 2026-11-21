import { describe, expect, it } from "vitest";
import { altAddressLines } from "./invoices";
import { companyBillTo, type Company } from "./companies";

describe("second addresses", () => {
  it("is hidden until its first line is filled in", () => {
    expect(altAddressLines({ alt_line1: "", alt_city: "Leeds" })).toEqual([]);
    expect(altAddressLines(null)).toEqual([]);
    expect(altAddressLines({ alt_line1: "Unit 4", alt_line2: null, alt_city: "Leeds", alt_county: "", alt_postcode: "LS1 1AA" })).toEqual(["Unit 4", "Leeds", "LS1 1AA"]);
  });
});

describe("invoicing a company", () => {
  it("puts the company name on the name line and its first address below", () => {
    const c = { id: "1", name: "Drapes Ltd", email: "a@b.co", phone: null, vat_number: null, company_number: null, line1: "1 Mill Lane", line2: null, city: "Bury", county: null, postcode: "BL9 0AA", note: null, alt_line1: "Site", alt_line2: null, alt_city: null, alt_county: null, alt_postcode: null } as Company;
    expect(companyBillTo(c)).toMatchObject({ full_name: "Drapes Ltd", company: null, line1: "1 Mill Lane", city: "Bury", postcode: "BL9 0AA", number: null });
  });
});
