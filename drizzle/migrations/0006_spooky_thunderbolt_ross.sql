ALTER TABLE `messages` ADD `user_id` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_url` text;--> statement-breakpoint
ALTER TABLE `users` ADD `signature` text;--> statement-breakpoint
ALTER TABLE `users` ADD `theme` text DEFAULT 'light' NOT NULL;--> statement-breakpoint
CREATE INDEX `bookmarks_user_created_idx` ON `bookmarks` (`user_id`,`created_at`);