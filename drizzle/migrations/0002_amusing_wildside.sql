ALTER TABLE `messages` ADD `parent_id` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `root_id` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `depth` integer DEFAULT 0 NOT NULL;