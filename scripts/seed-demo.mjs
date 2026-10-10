// Fills your DEV app with realistic Philippine small-business data through the real UI.
//   1. npm run dev            (leave it running on :3200)
//   2. node scripts/seed-demo.mjs
//   3. Sign in yourself in the window that opens. The script never sees your password.
// Re-running skips customers and items that already exist. Quotes and billing statements are added as drafts.
import { chromium } from "@playwright/test";

const BASE = process.env.SEED_BASE_URL ?? "http://localhost:3200";

const CUSTOMERS = [
  { name: "Rosa Reyes", company: "Reyes Bakery", email: "rosa.reyes@example.com", phone: "0917 555 0101" },
  { name: "Mark Villanueva", company: "Villanueva Hardware", email: "mark@example.com", phone: "0918 555 0102" },
  { name: "Liza Bautista", company: "Bautista Dental Clinic", email: "liza@example.com", phone: "0919 555 0103" },
  { name: "Jun Dela Cruz", company: "JD Auto Care", email: "jun@example.com", phone: "0920 555 0104" },
  { name: "Carmela Ocampo", company: "Ocampo Catering", email: "carmela@example.com", phone: "0921 555 0105" },
  { name: "Ramon Aquino", company: "Aquino Trading", email: "ramon@example.com", phone: "0922 555 0106" },
  { name: "Grace Mendoza", company: "", email: "grace.mendoza@example.com", phone: "0923 555 0107" },
  { name: "Paolo Santiago", company: "Santiago Print Shop", email: "paolo@example.com", phone: "0924 555 0108" },
];

const SERVICES = [
  { name: "Aircon cleaning (split type)", price: "1,500", unit: "unit" },
  { name: "Aircon installation", price: "4,500", unit: "unit" },
  { name: "Site inspection", price: "800", unit: "hour" },
  { name: "Electrical troubleshooting", price: "650", unit: "hour" },
];
const PRODUCTS = [
  { name: "Coil cleaner (500 ml)", sku: "CC-500", price: "320" },
  { name: "Copper pipe, 1/4 in (per meter)", sku: "CP-14", price: "280" },
];

// `then` is how far each document goes: quotes "sent" | "approved" | "declined";
// billing statements "sent" | "paid" | "partial". Omitted means it stays a draft.
const QUOTES = [
  { customer: "Rosa Reyes", then: "approved", lines: [["Aircon cleaning (split type)", "3", "1,500"], ["Coil cleaner (500 ml)", "2", "320"]] },
  { customer: "Mark Villanueva", then: "sent", lines: [["Aircon installation", "2", "4,500"], ["Copper pipe, 1/4 in (per meter)", "12", "280"]] },
  { customer: "Liza Bautista", lines: [["Site inspection", "2", "800"]] },
  { customer: "Carmela Ocampo", then: "declined", lines: [["Aircon cleaning (split type)", "5", "1,400"]] },
  { customer: "Paolo Santiago", lines: [["Electrical troubleshooting", "4", "650"], ["Coil cleaner (500 ml)", "1", "320"]] },
];
const INVOICES = [
  { customer: "Jun Dela Cruz", then: "paid", lines: [["Aircon cleaning (split type)", "2", "1,500"]] },
  { customer: "Ramon Aquino", then: "partial", lines: [["Electrical troubleshooting", "3", "650"]] },
  { customer: "Grace Mendoza", then: "sent", lines: [["Site inspection", "1", "800"]] },
];

try {
  await fetch(BASE, { redirect: "manual" });
} catch {
  console.error(`Can't reach ${BASE}. Start the app first (npm run dev in another terminal),`);
  console.error("then run this again. If it runs on another port: SEED_BASE_URL=http://localhost:PORT node scripts/seed-demo.mjs");
  process.exit(1);
}

const browser = await chromium.launch({ headless: false, slowMo: 60 });
const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await context.newPage();
page.setDefaultTimeout(30_000);

console.log("Sign in in the browser window (you have 5 minutes)...");
await page.goto(`${BASE}/sign-in`);
await page.waitForURL(/\/(dashboard|quotes|invoices|customers|catalog)/, { timeout: 300_000 });
console.log("Signed in. Adding data...");

async function exists(path, text) {
  await page.goto(`${BASE}${path}?q=${encodeURIComponent(text)}`);
  await page.waitForLoadState("networkidle");
  // Rows are links; the "No ... match" message also contains the name, so don't count plain text.
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (await page.getByRole("link", { name: new RegExp(escaped) }).count()) > 0;
}

for (const c of CUSTOMERS) {
  if (await exists("/customers", c.name)) continue;
  await page.goto(`${BASE}/customers/new`);
  await page.getByLabel("Name", { exact: true }).fill(c.name);
  if (c.company) await page.getByLabel("Company").fill(c.company);
  await page.getByRole("textbox", { name: /^Email/ }).fill(c.email);
  await page.getByLabel("Phone").fill(c.phone);
  await page.getByRole("button", { name: "Add customer" }).click();
  await page.waitForURL(/\/customers\/[0-9a-f-]{36}/);
  console.log("customer:", c.name);
}

for (const s of SERVICES) {
  if (await exists("/catalog", s.name)) continue;
  await page.goto(`${BASE}/catalog/services/new`);
  await page.getByLabel("Name", { exact: true }).fill(s.name);
  await page.getByLabel("Price per unit").fill(s.price);
  await page.getByLabel("Unit", { exact: true }).selectOption(s.unit);
  await page.getByRole("button", { name: "Add service" }).click();
  await page.waitForURL(/\/catalog\/services\/[0-9a-f-]{36}/);
  console.log("service:", s.name);
}
for (const p of PRODUCTS) {
  if (await exists("/catalog", p.name)) continue;
  await page.goto(`${BASE}/catalog/products/new`);
  await page.getByLabel("Name", { exact: true }).fill(p.name);
  await page.getByLabel("SKU").fill(p.sku);
  await page.getByLabel("Price per unit").fill(p.price);
  await page.getByRole("button", { name: "Add product" }).click();
  await page.waitForURL(/\/catalog\/products\/[0-9a-f-]{36}/);
  console.log("product:", p.name);
}

async function addDocument(kind, doc) {
  if (await exists(`/${kind}`, doc.customer)) return;
  await page.goto(`${BASE}/${kind}/new`);
  await page.getByRole("combobox", { name: "Customer", exact: true }).fill(doc.customer);
  await page.getByRole("option", { name: new RegExp(doc.customer) }).first().click();
  for (const [i, [desc, qty, price]] of doc.lines.entries()) {
    await page.getByRole("button", { name: "Add a line" }).click();
    await page.getByLabel(`Line ${i + 1} description`).fill(desc);
    await page.getByLabel("Qty").nth(i).fill(qty);
    await page.getByLabel("Price (PHP)").nth(i).fill(price);
  }
  await page.waitForURL(new RegExp(`/${kind}/[0-9a-f-]{36}$`));
  console.log(kind.slice(0, -1) + ":", doc.customer);
}
for (const q of QUOTES) await addDocument("quotes", q);
for (const i of INVOICES) await addDocument("invoices", i);

// ---- Lifecycle: sent, approved, declined, paid. Needs a verified email (the app won't send otherwise).
await page.goto(`${BASE}/dashboard`);
const unverified = (await page.getByRole("region", { name: "Email verification" }).count()) > 0;
if (unverified) {
  console.log("\nYour email isn't verified, so Tavi won't let me send documents. Drafts are in place.");
  console.log("To verify it in your DEV database, run this once in the Neon SQL editor, then run the script again:");
  console.log("  update users set email_verified = true where email = '<your email>';");
  await browser.close();
  process.exit(0);
}

async function openFirst(kind, customer) {
  await page.goto(`${BASE}/${kind}?q=${encodeURIComponent(customer)}`);
  await page.getByRole("link", { name: new RegExp(customer) }).first().click();
  await page.waitForURL(new RegExp(`/${kind}/[0-9a-f-]{36}`));
}

async function sendByLink() {
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /^Send / });
  await dialog.getByLabel("Copy link").check();
  await dialog.getByRole("button", { name: "Mark as sent and copy link" }).click();
  await page.locator("[data-sonner-toast]").filter({ hasText: /Link copied/ }).waitFor();
  return page.evaluate(() => navigator.clipboard.readText());
}

async function asCustomer(link, fn) {
  const c = await (await browser.newContext({ viewport: { width: 420, height: 860 } })).newPage();
  await c.goto(link);
  await fn(c);
  await c.context().close();
}

for (const q of QUOTES.filter((x) => x.then)) {
  await openFirst("quotes", q.customer);
  if ((await page.getByRole("button", { name: "Send", exact: true }).count()) === 0) continue; // already sent
  const link = await sendByLink();
  console.log("quote sent:", q.customer);
  if (q.then === "approved") {
    await asCustomer(link, async (c) => {
      await c.getByRole("button", { name: "Approve quote" }).click();
      const d = c.getByRole("dialog", { name: /^Approve / });
      await d.getByLabel("Your name").fill(q.customer);
      await d.getByRole("checkbox", { name: "I accept this quote, including its terms." }).click();
      await d.getByRole("button", { name: "Approve quote" }).click();
      await c.getByText(/^Approved by /).waitFor();
    });
    console.log("quote approved:", q.customer);
  }
  if (q.then === "declined") {
    await asCustomer(link, async (c) => {
      await c.getByRole("button", { name: /^Decline/ }).click();
      const d = c.getByRole("dialog");
      await d.getByLabel("Your name").fill(q.customer);
      await d.getByRole("button", { name: /Decline/ }).last().click();
      await c.getByText(/Declined/).first().waitFor();
    });
    console.log("quote declined:", q.customer);
  }
}

for (const i of INVOICES.filter((x) => x.then)) {
  await openFirst("invoices", i.customer);
  if ((await page.getByRole("button", { name: "Send", exact: true }).count()) > 0) {
    await sendByLink();
    console.log("billing statement sent:", i.customer);
  }
  if (i.then === "paid" || i.then === "partial") {
    await page.getByRole("button", { name: "Record payment" }).click();
    const d = page.getByRole("dialog", { name: "Record a payment" });
    await d.getByLabel("Method").selectOption({ label: "GCash or Maya" });
    if (i.then === "partial") {
      const full = await d.getByLabel(/^Amount received/).inputValue();
      const half = (Number(full.replace(/,/g, "")) / 2).toFixed(2);
      await d.getByLabel(/^Amount received/).fill(half);
    }
    await d.getByRole("button", { name: "Record payment" }).click();
    await page.locator("[data-sonner-toast]").filter({ hasText: /^Payment recorded/ }).waitFor();
    console.log("payment recorded:", i.customer, i.then);
  }
}

console.log("Done.");
await browser.close();
