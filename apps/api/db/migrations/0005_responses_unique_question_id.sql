DROP INDEX "responses_question_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "responses_question_id_uq" ON "responses" USING btree ("question_id");