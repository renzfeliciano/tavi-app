import { expect, test as setup } from "@playwright/test";
import { OWNER_STATE } from "../playwright.config";
import { createBusiness, markEmailVerified, signUp, strongPassword, uniqueEmail } from "./helpers";

setup("sign up an owner with a business", async ({ page }) => {
  const email = uniqueEmail("owner");
  await signUp(page, { name: "Maria Santos", email, password: strongPassword() });
  await createBusiness(page, "Acme Aircon Services");
  await expect(page.getByRole("heading", { level: 1, name: "Welcome to Tavi" })).toBeVisible();
  // The critical-path spec sends documents as this owner (sending needs a
  // confirmed address); specs about the unconfirmed state sign up their own.
  await markEmailVerified(email);

  await page.context().storageState({ path: OWNER_STATE });
});
