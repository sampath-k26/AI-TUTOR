CREATE TYPE "public"."learning_plan_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."learning_plan_step_type" AS ENUM('material', 'tutor', 'quiz', 'other');--> statement-breakpoint
CREATE TABLE "learning_plan_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"type" "learning_plan_step_type" NOT NULL,
	"description" text NOT NULL,
	"related_material_id" uuid,
	"related_concept_id" uuid,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "learning_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "learning_plan_status" DEFAULT 'active' NOT NULL,
	"rationale" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "learning_plan_steps" ADD CONSTRAINT "learning_plan_steps_plan_id_learning_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."learning_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_plan_steps" ADD CONSTRAINT "learning_plan_steps_related_material_id_materials_id_fk" FOREIGN KEY ("related_material_id") REFERENCES "public"."materials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_plan_steps" ADD CONSTRAINT "learning_plan_steps_related_concept_id_concepts_id_fk" FOREIGN KEY ("related_concept_id") REFERENCES "public"."concepts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_plans" ADD CONSTRAINT "learning_plans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "learning_plan_steps_plan_id_idx" ON "learning_plan_steps" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "learning_plans_project_id_idx" ON "learning_plans" USING btree ("project_id");