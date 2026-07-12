PRAGMA foreign_keys = ON;

CREATE TABLE `messages` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `content` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  `deleted` integer DEFAULT 0 NOT NULL,
  `parent_id` integer,
  `root_id` integer,
  `depth` integer DEFAULT 0 NOT NULL,
  `user_id` integer REFERENCES `users`(`id`)
);
CREATE INDEX `messages_list_idx` ON `messages` (`deleted`,`parent_id`,`created_at`);
CREATE INDEX `messages_root_idx` ON `messages` (`root_id`,`created_at`);

CREATE TABLE `users` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `username` text NOT NULL,
  `email` text NOT NULL,
  `password_hash` text NOT NULL,
  `is_admin` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL,
  `avatar_url` text,
  `signature` text,
  `theme` text DEFAULT 'light' NOT NULL
);
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);

CREATE TABLE `bookmarks` (
  `user_id` integer NOT NULL REFERENCES `users`(`id`),
  `message_id` integer NOT NULL REFERENCES `messages`(`id`),
  `created_at` integer NOT NULL
);
CREATE UNIQUE INDEX `bookmarks_user_id_message_id_unique` ON `bookmarks` (`user_id`,`message_id`);
CREATE INDEX `bookmarks_message_idx` ON `bookmarks` (`message_id`);
CREATE INDEX `bookmarks_user_created_idx` ON `bookmarks` (`user_id`,`created_at`);

CREATE TABLE `likes` (
  `user_id` integer NOT NULL REFERENCES `users`(`id`),
  `message_id` integer NOT NULL REFERENCES `messages`(`id`),
  `created_at` integer NOT NULL
);
CREATE UNIQUE INDEX `likes_user_id_message_id_unique` ON `likes` (`user_id`,`message_id`);
CREATE INDEX `likes_message_idx` ON `likes` (`message_id`);

CREATE TABLE `__drizzle_migrations` (
  `id` SERIAL PRIMARY KEY,
  `hash` text NOT NULL,
  `created_at` numeric
);

INSERT INTO `__drizzle_migrations` (`hash`, `created_at`) VALUES
  ('41dbb6a206cce25556df7c97cfdda77ffaafc838bb8f536a4a628b5c7ca3eb13', 1778574840717),
  ('b29207563b20f8a06ad54ab3bb4629e4da3c47168a44c6f83b0c391904e9e3d4', 1778579620102),
  ('909bac6f9d0f3f478381eb63a225c1760c14defe6ff78003e685ae633dbe3bdc', 1778658504588),
  ('d088ff1c2642b21225af951d4bc345477a8de3c581625ca8a3ba147664086097', 1778661854469),
  ('d0fd97b1e1a3ce8226cd1fad1bb38b3a7afc511570067b1ff8ca5df2f728669e', 1778662862319),
  ('f90bf3b14e0243474480a0016f160c9bc202320366cf957ba237fd41ca92d218', 1778856429875),
  ('8b1adce7170d134c082105de17e9ce21eed574d4a11cc5fef88fa528e6d5f390', 1779692187865);

INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `is_admin`, `created_at`, `avatar_url`, `signature`, `theme`) VALUES
  (1, 'alice', 'alice@example.test', 'hash-a', 1, 1779000000, '/uploads/alice.png', 'first signature', 'sumi'),
  (2, 'bob', 'bob@example.test', 'hash-b', 0, 1779000001, NULL, NULL, 'legacy-theme');

INSERT INTO `messages` (`id`, `name`, `content`, `created_at`, `updated_at`, `deleted`, `parent_id`, `root_id`, `depth`, `user_id`) VALUES
  (1, 'legacy-writer', 'anonymous legacy root', 1779000100, NULL, 0, NULL, NULL, 0, NULL),
  (2, 'alice', 'bound root', 1779000200, NULL, 0, NULL, NULL, 0, 1),
  (3, 'bob', 'depth one reply', 1779000300, NULL, 0, 2, 2, 1, 2),
  (4, 'alice', 'depth two reply', 1779000400, NULL, 0, 3, 2, 2, 1);

INSERT INTO `likes` (`user_id`, `message_id`, `created_at`) VALUES (2, 2, 1779000500);
INSERT INTO `bookmarks` (`user_id`, `message_id`, `created_at`) VALUES (1, 3, 1779000600);
