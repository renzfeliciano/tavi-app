import { sql } from "drizzle-orm";
import { char, check, customType, index, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "@/db/columns";
import { users } from "@/modules/identity/schema";
import { organizations } from "@/modules/organizations/schema";
import { FILE_PURPOSES } from "./domain/limits";

// Drizzle has no bytea column; node-postgres reads and writes it as a Buffer.
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

// Small files (logos) kept in Postgres itself, so the free tier needs no object
// storage (§I). Always select explicit columns: `data` is the file body.
export const files = pgTable(
  "files",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    purpose: text("purpose", { enum: FILE_PURPOSES }).notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    sha256: char("sha256", { length: 64 }).notNull(),
    data: bytea("data").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    index("files_organization_id_idx").on(t.organizationId),
    // One logo per organization; replacing it deletes the old row first.
    uniqueIndex("files_one_logo_per_organization")
      .on(t.organizationId)
      .where(sql`${t.purpose} = 'logo'`),
    check("files_purpose", sql`${t.purpose} in ('logo')`),
    check("files_content_type", sql`${t.contentType} in ('image/png', 'image/jpeg', 'image/webp')`),
    // 1 MiB, MAX_STORED_FILE_BYTES (DDL takes no parameters).
    check("files_byte_size", sql`${t.byteSize} between 1 and 1048576`),
    check("files_byte_size_matches", sql`octet_length(${t.data}) = ${t.byteSize}`),
  ],
);
