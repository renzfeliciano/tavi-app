/**
 * What kind of work a business does, and what kind of customer it bills
 * (docs/foundation-proposal.md D21). One list serves both: a business picks
 * its own at onboarding and may tag each customer. A category only adds
 * flavour: an icon, friendlier example wording, units and starter items
 * suggested for the catalog, and the Stamp's accessory. It never changes tax,
 * documents or money, so it holds no country-specific values (D12) and no prices.
 */

export const CATEGORY_CODES = [
  "food_beverage",
  "home_services",
  "construction",
  "beauty_wellness",
  "health",
  "education",
  "creative",
  "tech_it",
  "retail",
  "transport",
  "events",
  "professional",
  "other",
] as const;
export type CategoryCode = (typeof CATEGORY_CODES)[number];

/** The Stamp's small accessory for a category (D21); `null` leaves it bare. */
export type MascotAccessory = "chef" | "hardhat" | "scissors" | "cap" | "bow" | "glasses" | null;

export type Category = {
  code: CategoryCode;
  /** In the picker, on lists and in headings: "Food & beverage". */
  label: string;
  /** One line under the label in the onboarding picker. */
  hint: string;
  /** A believable first line item, for placeholders. */
  itemExample: string;
  /** Units this kind of work is usually sold in, best guess first. */
  units: string[];
  /** Names to offer as catalog items. No prices: those are the business's to set. */
  starterItems: { name: string; unit: string }[];
  accessory: MascotAccessory;
};

export const OTHER_CATEGORY: CategoryCode = "other";

export const CATEGORIES: Record<CategoryCode, Category> = {
  food_beverage: {
    code: "food_beverage",
    label: "Food & beverage",
    hint: "Catering, bakery, restaurant, coffee",
    itemExample: "Party tray, 20 pax",
    units: ["pack", "pax", "pc"],
    starterItems: [
      { name: "Party tray", unit: "pack" },
      { name: "Cake, custom order", unit: "pc" },
      { name: "Catering, per head", unit: "pax" },
      { name: "Delivery", unit: "trip" },
    ],
    accessory: "chef",
  },
  home_services: {
    code: "home_services",
    label: "Home services",
    hint: "Aircon, plumbing, cleaning, pest control",
    itemExample: "Aircon deep cleaning",
    units: ["unit", "visit", "hour"],
    starterItems: [
      { name: "Service call", unit: "visit" },
      { name: "Deep cleaning", unit: "unit" },
      { name: "Labour", unit: "hour" },
      { name: "Parts and materials", unit: "lot" },
    ],
    accessory: "hardhat",
  },
  construction: {
    code: "construction",
    label: "Construction & trades",
    hint: "Building, electrical, carpentry, fabrication",
    itemExample: "Wall painting, per square metre",
    units: ["sq m", "lot", "day"],
    starterItems: [
      { name: "Labour, per day", unit: "day" },
      { name: "Materials", unit: "lot" },
      { name: "Site inspection", unit: "visit" },
      { name: "Installation", unit: "lot" },
    ],
    accessory: "hardhat",
  },
  beauty_wellness: {
    code: "beauty_wellness",
    label: "Beauty & wellness",
    hint: "Salon, spa, barber, fitness",
    itemExample: "Haircut and blow-dry",
    units: ["session", "pc", "hour"],
    starterItems: [
      { name: "Haircut", unit: "session" },
      { name: "Massage, 60 minutes", unit: "session" },
      { name: "Home service fee", unit: "trip" },
      { name: "Package, 5 sessions", unit: "pack" },
    ],
    accessory: "scissors",
  },
  health: {
    code: "health",
    label: "Health & clinics",
    hint: "Clinic, dental, therapy, veterinary",
    itemExample: "Consultation",
    units: ["visit", "session", "pc"],
    starterItems: [
      { name: "Consultation", unit: "visit" },
      { name: "Follow-up", unit: "visit" },
      { name: "Procedure", unit: "pc" },
      { name: "Laboratory", unit: "pc" },
    ],
    accessory: "glasses",
  },
  education: {
    code: "education",
    label: "Education & tutoring",
    hint: "Tutoring, training, coaching, lessons",
    itemExample: "Tutoring, one hour",
    units: ["hour", "session", "month"],
    starterItems: [
      { name: "Tutoring session", unit: "hour" },
      { name: "Monthly tuition", unit: "month" },
      { name: "Workshop", unit: "session" },
      { name: "Materials", unit: "set" },
    ],
    accessory: "cap",
  },
  creative: {
    code: "creative",
    label: "Creative & media",
    hint: "Photo, video, design, printing",
    itemExample: "Photo shoot, half day",
    units: ["day", "pc", "hour"],
    starterItems: [
      { name: "Photo shoot, half day", unit: "day" },
      { name: "Logo design", unit: "pc" },
      { name: "Editing", unit: "hour" },
      { name: "Prints", unit: "pc" },
    ],
    accessory: "bow",
  },
  tech_it: {
    code: "tech_it",
    label: "Tech & IT",
    hint: "Web, software, devices, support",
    itemExample: "Website maintenance",
    units: ["hour", "month", "pc"],
    starterItems: [
      { name: "Development", unit: "hour" },
      { name: "Monthly support", unit: "month" },
      { name: "Setup and installation", unit: "lot" },
      { name: "Device repair", unit: "pc" },
    ],
    accessory: "glasses",
  },
  retail: {
    code: "retail",
    label: "Retail & wholesale",
    hint: "Shop, online store, distribution",
    itemExample: "Case of 24",
    units: ["pc", "box", "kg"],
    starterItems: [
      { name: "Product", unit: "pc" },
      { name: "Bulk order", unit: "box" },
      { name: "Shipping", unit: "trip" },
      { name: "Packaging", unit: "pc" },
    ],
    accessory: null,
  },
  transport: {
    code: "transport",
    label: "Transport & delivery",
    hint: "Delivery, hauling, courier, car hire",
    itemExample: "Delivery within Metro Manila",
    units: ["trip", "trip", "day"],
    starterItems: [
      { name: "Delivery", unit: "trip" },
      { name: "Hauling", unit: "trip" },
      { name: "Vehicle hire", unit: "day" },
      { name: "Waiting time", unit: "hour" },
    ],
    accessory: "cap",
  },
  events: {
    code: "events",
    label: "Events & entertainment",
    hint: "Events, hosting, rentals, production",
    itemExample: "Sound system rental",
    units: ["job", "day", "hour"],
    starterItems: [
      { name: "Event coordination", unit: "job" },
      { name: "Equipment rental", unit: "day" },
      { name: "Host or performer", unit: "hour" },
      { name: "Setup and teardown", unit: "lot" },
    ],
    accessory: "bow",
  },
  professional: {
    code: "professional",
    label: "Professional services",
    hint: "Consulting, accounting, legal, agency",
    itemExample: "Consulting, per hour",
    units: ["hour", "month", "lot"],
    starterItems: [
      { name: "Consulting", unit: "hour" },
      { name: "Monthly retainer", unit: "month" },
      { name: "Report or deliverable", unit: "lot" },
      { name: "Filing and processing", unit: "lot" },
    ],
    accessory: "glasses",
  },
  other: {
    code: "other",
    label: "Something else",
    hint: "None of these fit",
    itemExample: "Service",
    units: ["pc", "hour", "lot"],
    starterItems: [],
    accessory: null,
  },
};

export function isCategoryCode(value: unknown): value is CategoryCode {
  return typeof value === "string" && (CATEGORY_CODES as readonly string[]).includes(value);
}

/** The category for a stored code, or the neutral one when none is set. */
export function categoryFor(code: string | null | undefined): Category {
  return isCategoryCode(code) ? CATEGORIES[code] : CATEGORIES[OTHER_CATEGORY];
}
