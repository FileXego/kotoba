import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { asc, count } from "drizzle-orm";
import {
  buildMessageCapabilityPredicate,
  decideMessageAccess,
  visibleMessageWhere,
  visibleThreadWhere,
  type AccessDecision,
  type Capability,
  type MessageVisibility,
  type ModerationState,
  type ReplyPolicy,
  type Surface,
} from "../../src/lib/message-access";
import { messages } from "../../src/db/schema";
import { cleanup, setupApp, TEST_DB } from "../helpers";

interface FixtureMessage {
  id: number;
  authorId: number;
  visibility: MessageVisibility;
  moderationState: ModerationState;
  replyPolicy: ReplyPolicy;
  deleted: boolean;
  parentId: number | null;
  rootId: number | null;
  audienceAnchorUserId: number;
}

const fixtureMessages: FixtureMessage[] = [
  { id: 1, authorId: 1, visibility: "public", moderationState: "published", replyPolicy: "viewer", deleted: false, parentId: null, rootId: null, audienceAnchorUserId: 1 },
  { id: 2, authorId: 1, visibility: "quiet_public", moderationState: "published", replyPolicy: "viewer", deleted: false, parentId: null, rootId: null, audienceAnchorUserId: 1 },
  { id: 3, authorId: 1, visibility: "acquaintance", moderationState: "published", replyPolicy: "viewer", deleted: false, parentId: null, rootId: null, audienceAnchorUserId: 1 },
  { id: 4, authorId: 1, visibility: "private", moderationState: "published", replyPolicy: "viewer", deleted: false, parentId: null, rootId: null, audienceAnchorUserId: 1 },
  { id: 5, authorId: 1, visibility: "public", moderationState: "held", replyPolicy: "viewer", deleted: false, parentId: null, rootId: null, audienceAnchorUserId: 1 },
  { id: 6, authorId: 1, visibility: "public", moderationState: "removed", replyPolicy: "viewer", deleted: false, parentId: null, rootId: null, audienceAnchorUserId: 1 },
  { id: 7, authorId: 1, visibility: "public", moderationState: "published", replyPolicy: "viewer", deleted: true, parentId: null, rootId: null, audienceAnchorUserId: 1 },
  { id: 8, authorId: 1, visibility: "public", moderationState: "published", replyPolicy: "closed", deleted: false, parentId: null, rootId: null, audienceAnchorUserId: 1 },
  { id: 9, authorId: 2, visibility: "public", moderationState: "published", replyPolicy: "viewer", deleted: false, parentId: 8, rootId: 8, audienceAnchorUserId: 1 },
  { id: 10, authorId: 1, visibility: "acquaintance", moderationState: "published", replyPolicy: "viewer", deleted: false, parentId: null, rootId: null, audienceAnchorUserId: 1 },
  { id: 11, authorId: 3, visibility: "public", moderationState: "published", replyPolicy: "viewer", deleted: false, parentId: 10, rootId: 10, audienceAnchorUserId: 1 },
  { id: 12, authorId: 2, visibility: "public", moderationState: "published", replyPolicy: "viewer", deleted: false, parentId: 11, rootId: 10, audienceAnchorUserId: 1 },
  { id: 13, authorId: 1, visibility: "quiet_public", moderationState: "published", replyPolicy: "viewer", deleted: false, parentId: null, rootId: null, audienceAnchorUserId: 1 },
  { id: 14, authorId: 2, visibility: "public", moderationState: "published", replyPolicy: "viewer", deleted: false, parentId: 13, rootId: 13, audienceAnchorUserId: 1 },
  { id: 15, authorId: 2, visibility: "public", moderationState: "published", replyPolicy: "viewer", deleted: false, parentId: null, rootId: null, audienceAnchorUserId: 2 },
  { id: 16, authorId: 1, visibility: "private", moderationState: "published", replyPolicy: "viewer", deleted: false, parentId: 15, rootId: 15, audienceAnchorUserId: 2 },
  { id: 17, authorId: 1, visibility: "public", moderationState: "published", replyPolicy: "viewer", deleted: false, parentId: 15, rootId: 15, audienceAnchorUserId: 2 },
];

const follows = new Set(["1:2", "2:1", "3:1"]);
const mutes = new Set(["3:1"]);
const blocks = new Set(["4:1"]);
const messageById = new Map(fixtureMessages.map((message) => [message.id, message]));

function hasPair(set: Set<string>, first: number | null, second: number | null) {
  return first !== null && second !== null && set.has(`${first}:${second}`);
}

function isBlocked(first: number | null, second: number | null) {
  return hasPair(blocks, first, second) || hasPair(blocks, second, first);
}

function pureDecision(
  message: FixtureMessage,
  viewerId: number | null,
  isReviewer: boolean,
  surface: Surface,
): AccessDecision {
  const ancestorIds = [...new Set([message.parentId, message.rootId])]
    .filter((id): id is number => id !== null && id !== message.id);
  const ancestors = ancestorIds.map((id) => {
    const ancestor = messageById.get(id);
    if (!ancestor) throw new Error(`Missing fixture ancestor ${id}`);
    return pureDecision(ancestor, viewerId, isReviewer, surface);
  });
  const anchorId = message.audienceAnchorUserId;
  return decideMessageAccess({
    viewer: { userId: viewerId, isReviewer },
    surface,
    message: {
      authorId: message.authorId,
      audienceAnchorUserId: anchorId,
      visibility: message.visibility,
      moderationState: message.moderationState,
      replyPolicy: message.replyPolicy,
      deleted: message.deleted,
    },
    relationship: {
      viewerFollowsAuthor: hasPair(follows, viewerId, message.authorId),
      viewerFollowsAnchor: hasPair(follows, viewerId, anchorId),
      anchorFollowsViewer: hasPair(follows, anchorId, viewerId),
      viewerMutesAuthor: hasPair(mutes, viewerId, message.authorId),
      blockedEitherDirection:
        isBlocked(viewerId, message.authorId) || isBlocked(viewerId, anchorId),
    },
    ancestors,
  });
}

describe("SQL message access predicate", () => {
  beforeAll(async () => {
    await setupApp();
    const sqlite = new Database(TEST_DB);
    sqlite.exec(`
      INSERT INTO users (id, username, email, password_hash, is_admin, created_at)
      VALUES
        (1, 'alice', 'alice@access.test', 'hash-1', 0, 1),
        (2, 'bob', 'bob@access.test', 'hash-2', 0, 2),
        (3, 'carol', 'carol@access.test', 'hash-3', 0, 3),
        (4, 'dave', 'dave@access.test', 'hash-4', 0, 4),
        (5, 'reviewer', 'reviewer@access.test', 'hash-5', 1, 5);

      INSERT INTO follows (follower_id, followed_id, active, created_at, updated_at)
      VALUES (1, 2, 1, 1, 1), (2, 1, 1, 1, 1), (3, 1, 1, 1, 1);
      INSERT INTO mutes (muter_id, muted_id, active, created_at, updated_at)
      VALUES (3, 1, 1, 1, 1);
      INSERT INTO blocks (blocker_id, blocked_id, active, created_at, updated_at)
      VALUES (4, 1, 1, 1, 1);
    `);
    const insert = sqlite.prepare(`
      INSERT INTO messages (
        id, name, content, created_at, deleted, parent_id, root_id, depth, user_id,
        visibility, audience_anchor_user_id, moderation_state, content_version, reply_policy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);
    for (const message of fixtureMessages) {
      const depth = message.parentId === null ? 0 : message.parentId === message.rootId ? 1 : 2;
      insert.run(
        message.id,
        `author-${message.authorId}`,
        `message-${message.id}`,
        message.id,
        message.deleted ? 1 : 0,
        message.parentId,
        message.rootId,
        depth,
        message.authorId,
        message.visibility,
        message.audienceAnchorUserId,
        message.moderationState,
        message.replyPolicy,
      );
    }
    insert.finalize();
    sqlite.close();
  });

  afterAll(() => cleanup());

  it("matches pure-policy IDs and counts for every viewer and surface", async () => {
    const { db } = await import("../../src/db/index");
    const viewers = [
      { userId: null, isReviewer: false },
      { userId: 1, isReviewer: false },
      { userId: 2, isReviewer: false },
      { userId: 3, isReviewer: false },
      { userId: 4, isReviewer: false },
      { userId: 5, isReviewer: true },
    ];
    const surfaces: Surface[] = [
      "garden",
      "following",
      "profile",
      "thread",
      "search",
      "bookmarks",
      "activity",
    ];

    for (const viewer of viewers) {
      for (const surface of surfaces) {
        const useRead = surface === "thread" || surface === "bookmarks";
        const expected = fixtureMessages
          .filter((message) => {
            const decision = pureDecision(message, viewer.userId, viewer.isReviewer, surface);
            return useRead ? decision.mayRead : decision.mayDiscover;
          })
          .map((message) => message.id);
        const where = visibleMessageWhere(viewer, surface);
        const rows = await db
          .select({ id: messages.id })
          .from(messages)
          .where(where)
          .orderBy(asc(messages.id));
        const aggregate = await db.select({ value: count() }).from(messages).where(where);

        expect(rows.map((row) => row.id)).toEqual(expected);
        expect(aggregate[0]?.value).toBe(expected.length);
      }
    }
  });

  it("scopes a thread before returning its root or descendants", async () => {
    const { db } = await import("../../src/db/index");
    for (const viewer of [
      { userId: 2, isReviewer: false },
      { userId: 3, isReviewer: false },
      { userId: 5, isReviewer: true },
    ]) {
      const expected = fixtureMessages
        .filter((message) => message.id === 10 || message.rootId === 10)
        .filter((message) => pureDecision(message, viewer.userId, viewer.isReviewer, "thread").mayRead)
        .map((message) => message.id);
      const rows = await db
        .select({ id: messages.id })
        .from(messages)
        .where(visibleThreadWhere(viewer, 10))
        .orderBy(asc(messages.id));
      expect(rows.map((row) => row.id)).toEqual(expected);
    }
  });

  it("matches pure reply, reaction, and mention capabilities", async () => {
    const { db } = await import("../../src/db/index");
    const capabilities: Array<Exclude<Capability, "read" | "discover">> = [
      "reply",
      "react",
      "mention",
    ];
    for (const viewer of [
      { userId: null, isReviewer: false },
      { userId: 1, isReviewer: false },
      { userId: 2, isReviewer: false },
      { userId: 3, isReviewer: false },
      { userId: 4, isReviewer: false },
      { userId: 5, isReviewer: true },
    ]) {
      for (const capability of capabilities) {
        const decisionKey = capability === "reply"
          ? "mayReply"
          : capability === "react"
            ? "mayReact"
            : "mayMention";
        const expected = fixtureMessages
          .filter((message) => pureDecision(
            message,
            viewer.userId,
            viewer.isReviewer,
            "thread",
          )[decisionKey])
          .map((message) => message.id);
        const rows = await db
          .select({ id: messages.id })
          .from(messages)
          .where(buildMessageCapabilityPredicate(viewer, capability))
          .orderBy(asc(messages.id));
        expect(rows.map((row) => row.id)).toEqual(expected);
      }
    }
  });
});
