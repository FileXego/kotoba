CREATE TABLE `bookmarks` (
	`user_id` integer NOT NULL,
	`message_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookmarks_user_id_message_id_unique` ON `bookmarks` (`user_id`,`message_id`);--> statement-breakpoint
CREATE TABLE `likes` (
	`user_id` integer NOT NULL,
	`message_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `likes_user_id_message_id_unique` ON `likes` (`user_id`,`message_id`);