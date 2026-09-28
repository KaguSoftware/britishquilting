export const EXPENSE_CATEGORIES = [
  { value: "stock", label: "Fabric and stock" },
  { value: "postage", label: "Postage and couriers" },
  { value: "packaging", label: "Packaging" },
  { value: "rent", label: "Rent and rates" },
  { value: "utilities", label: "Utilities" },
  { value: "software", label: "Software and website" },
  { value: "marketing", label: "Marketing" },
  { value: "equipment", label: "Equipment" },
  { value: "travel", label: "Travel" },
  { value: "professional", label: "Accountant and legal" },
  { value: "bank_fees", label: "Bank and card fees" },
  { value: "wages", label: "Wages" },
  { value: "other", label: "Other" },
] as const;

export const expenseCategoryLabel = (v: string) => EXPENSE_CATEGORIES.find((c) => c.value === v)?.label ?? v;
