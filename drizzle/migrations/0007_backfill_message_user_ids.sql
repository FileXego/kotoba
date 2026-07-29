-- Bind only messages whose matching account already existed when the message was created.
-- A same-named account registered after an anonymous message must not claim its authorship.
UPDATE `messages`
SET `user_id` = (
  SELECT `users`.`id`
  FROM `users`
  WHERE `users`.`username` = `messages`.`name`
    AND `users`.`created_at` < `messages`.`created_at`
)
WHERE `messages`.`user_id` IS NULL
  AND EXISTS (
    SELECT 1
    FROM `users`
    WHERE `users`.`username` = `messages`.`name`
      AND `users`.`created_at` < `messages`.`created_at`
  );
