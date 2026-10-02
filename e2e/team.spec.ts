import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { latestInvitationPath, strongPassword, uniqueEmail } from "./helpers";

// Team invitations (Phase 2.1, D17): the shared owner invites a new person,
// who signs up from the link and joins; then the owner removes them.
// Creates one account, so it runs on desktop only (ACCOUNT_CREATING_SPECS).

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();

test("invite someone, they sign up from the link and join, then they're removed", async ({ page, browser }) => {
  const email = uniqueEmail("teammate");

  await page.goto("/settings/team");
  expect((await axe(page)).violations).toEqual([]);
  await page.getByRole("textbox", { name: /^Email/ }).fill(email);
  await page.getByLabel("Role").selectOption("admin");
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText(`Invitation sent to ${email}.`)).toBeVisible();
  await expect(page.getByRole("region", { name: "Invitations" }).getByText(email)).toBeVisible();

  // The invited person, in their own browser.
  const invitee = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage();
  await invitee.goto(await latestInvitationPath(email));
  await expect(invitee.getByRole("heading", { name: "Join Acme Aircon Services" })).toBeVisible();
  expect((await axe(invitee)).violations).toEqual([]);
  await invitee.getByRole("link", { name: "Create an account" }).click();
  await invitee.getByLabel("Your name").fill("Ana Reyes");
  await invitee.getByLabel("Work email").fill(email);
  await invitee.getByLabel("Password", { exact: true }).fill(strongPassword());
  await invitee.getByRole("checkbox", { name: /^I agree to the Terms of Service/ }).click();
  await invitee.getByRole("button", { name: "Create account" }).click();
  await expect(invitee).toHaveURL(/\/invite\//);
  await invitee.getByRole("button", { name: "Join Acme Aircon Services" }).click();
  await expect(invitee).toHaveURL(/\/dashboard$/);
  await expect(invitee.getByText("Acme Aircon Services").first()).toBeVisible();

  // The owner sees them in the team, as an admin, and removes them.
  await page.reload();
  const row = page.getByRole("listitem").filter({ hasText: email });
  await expect(row.getByRole("combobox", { name: "Role for Ana Reyes" })).toHaveValue("admin");
  await row.getByRole("button", { name: "Remove" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove Ana Reyes" }).click();
  await expect(page.getByText("Ana Reyes removed from Acme Aircon Services.")).toBeVisible();

  // Their access is gone at once: with no business left, they're asked to set one up.
  await invitee.goto("/dashboard");
  await expect(invitee).toHaveURL(/\/onboarding$/);
  await invitee.context().close();
});
