CREATE TABLE `blocks` (
	`blocker_id` integer NOT NULL,
	`blocked_id` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`blocker_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`blocked_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "blocks_no_self" CHECK("blocks"."blocker_id" <> "blocks"."blocked_id")
);
--> statement-breakpoint
CREATE INDEX `blocks_blocker_active_idx` ON `blocks` (`blocker_id`,`active`);--> statement-breakpoint
CREATE INDEX `blocks_blocked_active_idx` ON `blocks` (`blocked_id`,`active`);--> statement-breakpoint
CREATE UNIQUE INDEX `blocks_pair_unique` ON `blocks` (`blocker_id`,`blocked_id`);--> statement-breakpoint
CREATE TABLE `follows` (
	`follower_id` integer NOT NULL,
	`followed_id` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`followed_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "follows_no_self" CHECK("follows"."follower_id" <> "follows"."followed_id")
);
--> statement-breakpoint
CREATE INDEX `follows_followed_active_idx` ON `follows` (`followed_id`,`active`);--> statement-breakpoint
CREATE UNIQUE INDEX `follows_pair_unique` ON `follows` (`follower_id`,`followed_id`);--> statement-breakpoint
CREATE TABLE `mutes` (
	`muter_id` integer NOT NULL,
	`muted_id` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`muter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`muted_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "mutes_no_self" CHECK("mutes"."muter_id" <> "mutes"."muted_id")
);
--> statement-breakpoint
CREATE INDEX `mutes_muter_active_idx` ON `mutes` (`muter_id`,`active`);--> statement-breakpoint
CREATE UNIQUE INDEX `mutes_pair_unique` ON `mutes` (`muter_id`,`muted_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`avatar_url` text,
	`signature` text,
	`edition` text DEFAULT 'light' NOT NULL,
	`seal_color` text DEFAULT 'cinnabar' NOT NULL,
	`paper` text DEFAULT 'balanced' NOT NULL,
	`title_face` text DEFAULT 'song' NOT NULL,
	`default_visibility` text DEFAULT 'public' NOT NULL,
	`default_reply_policy` text DEFAULT 'viewer' NOT NULL,
	`activity_audience` text DEFAULT 'public' NOT NULL,
	`discoverable` integer DEFAULT 1 NOT NULL,
	`external_indexing` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `profiles_display_name_idx` ON `profiles` (`display_name`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`csrf_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`revoked_at` integer,
	`user_agent` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_activity_idx` ON `sessions` (`user_id`,`revoked_at`,`expires_at`);--> statement-breakpoint
ALTER TABLE `messages` ADD `visibility` text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `audience_anchor_user_id` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `messages` ADD `moderation_state` text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `content_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `reply_policy` text DEFAULT 'viewer' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `client_request_id` text;--> statement-breakpoint
CREATE INDEX `messages_feed_idx` ON `messages` (`deleted`,`moderation_state`,`visibility`,`parent_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `messages_author_created_idx` ON `messages` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `messages_user_client_request_unique` ON `messages` (`user_id`,`client_request_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified_at` integer;
--> statement-breakpoint
INSERT INTO `profiles` (
	`user_id`,
	`display_name`,
	`avatar_url`,
	`signature`,
	`edition`,
	`updated_at`
)
SELECT
	`id`,
	`username`,
	`avatar_url`,
	`signature`,
	CASE
		WHEN `theme` IN ('light', 'dark', 'sumi', 'sakura') THEN `theme`
		ELSE 'light'
	END,
	`created_at`
FROM `users`;
--> statement-breakpoint
UPDATE `messages`
SET `audience_anchor_user_id` = `user_id`
WHERE `depth` = 0 AND `user_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `messages`
SET `audience_anchor_user_id` = (
	SELECT `root`.`audience_anchor_user_id`
	FROM `messages` AS `root`
	WHERE `root`.`id` = `messages`.`root_id`
)
WHERE `depth` = 1;
--> statement-breakpoint
UPDATE `messages`
SET `audience_anchor_user_id` = (
	SELECT `root`.`audience_anchor_user_id`
	FROM `messages` AS `root`
	WHERE `root`.`id` = `messages`.`root_id`
)
WHERE `depth` = 2;
