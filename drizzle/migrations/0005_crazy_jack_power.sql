CREATE INDEX `bookmarks_message_idx` ON `bookmarks` (`message_id`);--> statement-breakpoint
CREATE INDEX `likes_message_idx` ON `likes` (`message_id`);--> statement-breakpoint
CREATE INDEX `messages_list_idx` ON `messages` (`deleted`,`parent_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `messages_root_idx` ON `messages` (`root_id`,`created_at`);