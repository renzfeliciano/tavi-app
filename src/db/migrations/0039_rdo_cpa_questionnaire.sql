CREATE TABLE "tax_questionnaires" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"facts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"questions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tax_questionnaires_facts_object" CHECK (jsonb_typeof("tax_questionnaires"."facts") = 'object'),
	CONSTRAINT "tax_questionnaires_questions_object" CHECK (jsonb_typeof("tax_questionnaires"."questions") = 'object')
);
--> statement-breakpoint
ALTER TABLE "tax_questionnaires" ADD CONSTRAINT "tax_questionnaires_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_questionnaires" ADD CONSTRAINT "tax_questionnaires_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;