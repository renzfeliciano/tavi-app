CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"default_currency" char(3) DEFAULT 'PHP' NOT NULL,
	"timezone" text DEFAULT 'Asia/Manila' NOT NULL,
	"locale" text DEFAULT 'en-PH' NOT NULL,
	"tax_mode" text DEFAULT 'inclusive' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_name_not_blank" CHECK (length(btrim("organizations"."name")) > 0),
	CONSTRAINT "organizations_currency_iso" CHECK ("organizations"."default_currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "organizations_tax_mode" CHECK ("organizations"."tax_mode" in ('inclusive', 'exclusive'))
);
--> statement-breakpoint
CREATE TABLE "document_sequences" (
	"organization_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"prefix" text NOT NULL,
	"next_value" bigint DEFAULT 1 NOT NULL,
	"padding" integer DEFAULT 6 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_sequences_organization_id_kind_pk" PRIMARY KEY("organization_id","kind"),
	CONSTRAINT "document_sequences_kind" CHECK ("document_sequences"."kind" in ('quote', 'invoice', 'receipt')),
	CONSTRAINT "document_sequences_next_value_positive" CHECK ("document_sequences"."next_value" >= 1),
	CONSTRAINT "document_sequences_padding_range" CHECK ("document_sequences"."padding" between 1 and 12),
	CONSTRAINT "document_sequences_prefix_length" CHECK (char_length("document_sequences"."prefix") <= 12)
);
--> statement-breakpoint
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;