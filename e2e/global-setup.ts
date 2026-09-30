import resetAndMigrate from "../src/db/testing/global-setup";

/** Fresh, fully migrated test database before every E2E run. */
export default async function globalSetup() {
  await resetAndMigrate();
}
