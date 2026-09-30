// Validation copy built from the limit itself, so a message never restates a
// number that could drift from the rule.

/** "Use 2,000 characters or fewer." */
export const tooLong = (max: number) => `Use ${max.toLocaleString("en")} characters or fewer.`;

/** "Choose between 1 and 365 days." */
export const dayRange = ({ min, max }: { min: number; max: number }) =>
  `Choose between ${min} and ${max} days.`;
