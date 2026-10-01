/** Every signed-in screen that renders without an id: checked for axe and overflow (app-shell) and across the device matrix. */
export const SCREENS = [
  "/dashboard",
  "/quotes",
  "/quotes/new",
  "/invoices",
  "/payments",
  "/customers",
  "/customers/new",
  "/catalog",
  "/catalog?type=products",
  "/catalog/services/new",
  "/catalog/products/new",
  "/settings",
  "/settings/business",
  "/settings/tax-rates",
  "/settings/numbering",
  "/settings/security",
] as const;
