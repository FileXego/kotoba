ALTER TABLE `messages` ADD `updated_at` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `deleted` integer DEFAULT 0 NOT NULL;