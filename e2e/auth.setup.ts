import { expect, test as setup } from "@playwright/test";
import { OWNER_STATE } from "../playwright.config";
import { createBusiness, signUp, strongPassword, uniqueEmail } from "./helpers";

setup("sign up an owner with a business", async ({ page }) => {
  await signUp(page, {
    name: "Maria Santos",
    email: uniqueEmail("owner"),
    password: strongPassword(),
  });
  await createBusiness(page, "Acme Aircon Services");
  await expect(page.getByRole("heading", { level: 1, name: "Welcome to Tavi" })).toBeVisible();

  await page.context().storageState({ path: OWNER_STATE });
});
