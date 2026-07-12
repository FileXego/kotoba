export type Surface =
  | "garden"
  | "following"
  | "profile"
  | "thread"
  | "search"
  | "bookmarks"
  | "activity";

export type Capability = "read" | "discover" | "reply" | "react" | "mention";
export type MessageVisibility = "public" | "quiet_public" | "acquaintance" | "private";
export type ModerationState = "published" | "held" | "removed";
export type ReplyPolicy = "viewer" | "acquaintance" | "closed";

export interface AccessDecision {
  mayRead: boolean;
  mayDiscover: boolean;
  mayReply: boolean;
  mayReact: boolean;
  mayMention: boolean;
}

export interface AccessContext {
  viewer: {
    userId: number | null;
    isReviewer?: boolean;
  };
  surface: Surface;
  message: {
    authorId: number | null;
    audienceAnchorUserId: number | null;
    visibility: MessageVisibility;
    moderationState: ModerationState;
    replyPolicy: ReplyPolicy;
    deleted: boolean;
  };
  relationship: {
    viewerFollowsAuthor: boolean;
    viewerFollowsAnchor: boolean;
    anchorFollowsViewer: boolean;
    viewerMutesAuthor: boolean;
    blockedEitherDirection: boolean;
  };
  ancestors?: readonly AccessDecision[];
}

export interface PolicyViewer {
  userId: number | null;
  isReviewer?: boolean;
}

const AMBIENT_SURFACES = new Set<Surface>([
  "garden",
  "following",
  "search",
  "activity",
]);

function isAcquaintance(context: AccessContext) {
  return context.relationship.viewerFollowsAnchor
    && context.relationship.anchorFollowsViewer
    && !context.relationship.blockedEitherDirection;
}

function audienceAllows(context: AccessContext, owner: boolean) {
  if (owner) return true;
  switch (context.message.visibility) {
    case "public":
    case "quiet_public":
      return true;
    case "acquaintance":
      return isAcquaintance(context);
    case "private":
      return false;
  }
}

function distributionAllows(context: AccessContext, owner: boolean) {
  switch (context.surface) {
    case "garden":
    case "search":
      return context.message.visibility === "public";
    case "following":
      return context.relationship.viewerFollowsAuthor
        && context.message.visibility !== "private";
    case "profile":
    case "thread":
    case "bookmarks":
    case "activity":
      return context.message.visibility !== "private" || owner;
  }
}

function intersectWithAncestors(
  decision: AccessDecision,
  ancestors: readonly AccessDecision[],
) {
  for (const ancestor of ancestors) {
    decision.mayRead &&= ancestor.mayRead;
    decision.mayDiscover &&= ancestor.mayDiscover;
    decision.mayReply &&= ancestor.mayReply;
    decision.mayReact &&= ancestor.mayReact;
    decision.mayMention &&= ancestor.mayMention;
  }
  return decision;
}

export function decideMessageAccess(context: AccessContext): AccessDecision {
  const viewerId = context.viewer.userId;
  const owner = viewerId !== null && viewerId === context.message.authorId;
  const reviewer = context.viewer.isReviewer === true;
  const published = context.message.moderationState === "published";
  const ordinaryMayRead = audienceAllows(context, owner);

  let mayRead: boolean;
  if (reviewer) {
    mayRead = true;
  } else if (context.message.deleted || context.message.moderationState === "removed") {
    mayRead = reviewer;
  } else if (context.message.moderationState === "held") {
    mayRead = owner || reviewer;
  } else {
    mayRead = ordinaryMayRead;
  }

  const mutedFromSurface = context.relationship.viewerMutesAuthor
    && AMBIENT_SURFACES.has(context.surface);
  const mayDiscover = mayRead
    && published
    && !context.message.deleted
    && distributionAllows(context, owner)
    && !context.relationship.blockedEitherDirection
    && !mutedFromSurface;

  const mayInteract = ordinaryMayRead
    && published
    && !context.message.deleted
    && viewerId !== null
    && !context.relationship.blockedEitherDirection;
  const mayReply = mayInteract && (
    context.message.replyPolicy === "viewer"
    || (context.message.replyPolicy === "acquaintance" && isAcquaintance(context))
  );

  return intersectWithAncestors({
    mayRead,
    mayDiscover,
    mayReply,
    mayReact: mayInteract,
    mayMention: mayInteract,
  }, context.ancestors ?? []);
}

export function mayInteractWithMessage(
  context: AccessContext,
  capability: Exclude<Capability, "read" | "discover">,
) {
  const decision = decideMessageAccess(context);
  if (capability === "reply") return decision.mayReply;
  if (capability === "react") return decision.mayReact;
  return decision.mayMention;
}

export function deriveAudienceAnchor(
  parent: { authorId: number | null; audienceAnchorUserId: number | null } | null,
  authorId: number | null,
  _requestedVisibility: MessageVisibility,
) {
  if (!parent) return authorId;
  return parent.audienceAnchorUserId ?? parent.authorId;
}

const accessAncestor = alias(messages, "access_ancestor");
type MessageAccessRow = typeof messages | typeof accessAncestor;
type SqlValue = number | SQLWrapper;

function all(...conditions: Array<SQL | undefined>) {
  return and(...conditions) ?? sql`0`;
}

function any(...conditions: Array<SQL | undefined>) {
  return or(...conditions) ?? sql`0`;
}

function activeFollow(followerId: SqlValue, followedId: SqlValue) {
  return sql`EXISTS (
    SELECT 1 FROM ${follows}
    WHERE ${follows.followerId} = ${followerId}
      AND ${follows.followedId} = ${followedId}
      AND ${follows.active} = 1
  )`;
}

function noActiveBlock(viewerId: number, targetId: SqlValue) {
  return sql`NOT EXISTS (
    SELECT 1 FROM ${blocks}
    WHERE ${blocks.active} = 1
      AND (
        (${blocks.blockerId} = ${viewerId} AND ${blocks.blockedId} = ${targetId})
        OR (${blocks.blockerId} = ${targetId} AND ${blocks.blockedId} = ${viewerId})
      )
  )`;
}

function noMessageBlock(viewerId: number | null, row: MessageAccessRow) {
  if (viewerId === null) return sql`1`;
  return sql`NOT EXISTS (
    SELECT 1 FROM ${blocks}
    WHERE ${blocks.active} = 1
      AND (
        (
          ${blocks.blockerId} = ${viewerId}
          AND (
            ${blocks.blockedId} = ${row.userId}
            OR ${blocks.blockedId} = ${row.audienceAnchorUserId}
          )
        )
        OR (
          ${blocks.blockedId} = ${viewerId}
          AND (
            ${blocks.blockerId} = ${row.userId}
            OR ${blocks.blockerId} = ${row.audienceAnchorUserId}
          )
        )
      )
  )`;
}

function notMuted(viewerId: number | null, row: MessageAccessRow) {
  if (viewerId === null) return sql`1`;
  return sql`NOT EXISTS (
    SELECT 1 FROM ${mutes}
    WHERE ${mutes.muterId} = ${viewerId}
      AND ${mutes.mutedId} = ${row.userId}
      AND ${mutes.active} = 1
  )`;
}

function ownerPredicate(viewerId: number | null, row: MessageAccessRow) {
  if (viewerId === null) return sql`0`;
  return eq(row.userId, viewerId);
}

function acquaintancePredicate(viewerId: number | null, row: MessageAccessRow) {
  if (viewerId === null) return sql`0`;
  return all(
    activeFollow(viewerId, row.audienceAnchorUserId),
    activeFollow(row.audienceAnchorUserId, viewerId),
    noActiveBlock(viewerId, row.audienceAnchorUserId),
  );
}

function ordinaryReadPredicate(viewer: PolicyViewer, row: MessageAccessRow) {
  const owner = ownerPredicate(viewer.userId, row);
  return any(
    owner,
    eq(row.visibility, "public"),
    eq(row.visibility, "quiet_public"),
    all(eq(row.visibility, "acquaintance"), acquaintancePredicate(viewer.userId, row)),
  );
}

function readPredicate(viewer: PolicyViewer, row: MessageAccessRow) {
  if (viewer.isReviewer === true) return sql`1`;
  const owner = ownerPredicate(viewer.userId, row);
  return all(
    eq(row.deleted, 0),
    any(
      all(eq(row.moderationState, "held"), owner),
      all(
        eq(row.moderationState, "published"),
        ordinaryReadPredicate(viewer, row),
      ),
    ),
  );
}

function distributionPredicate(
  viewer: PolicyViewer,
  surface: Surface,
  row: MessageAccessRow,
) {
  const owner = ownerPredicate(viewer.userId, row);
  switch (surface) {
    case "garden":
    case "search":
      return eq(row.visibility, "public");
    case "following":
      if (viewer.userId === null) return sql`0`;
      return all(
        activeFollow(viewer.userId, row.userId),
        sql`${row.visibility} <> 'private'`,
      );
    case "profile":
    case "thread":
    case "bookmarks":
    case "activity":
      return any(sql`${row.visibility} <> 'private'`, owner);
  }
}

function discoveryPredicate(
  viewer: PolicyViewer,
  surface: Surface,
  row: MessageAccessRow,
) {
  const muteAllows = AMBIENT_SURFACES.has(surface)
    ? notMuted(viewer.userId, row)
    : sql`1`;
  return all(
    readPredicate(viewer, row),
    eq(row.deleted, 0),
    eq(row.moderationState, "published"),
    distributionPredicate(viewer, surface, row),
    noMessageBlock(viewer.userId, row),
    muteAllows,
  );
}

function replyPredicate(viewer: PolicyViewer, row: MessageAccessRow) {
  if (viewer.userId === null) return sql`0`;
  return all(
    ordinaryReadPredicate(viewer, row),
    eq(row.deleted, 0),
    eq(row.moderationState, "published"),
    noMessageBlock(viewer.userId, row),
    any(
      eq(row.replyPolicy, "viewer"),
      all(
        eq(row.replyPolicy, "acquaintance"),
        acquaintancePredicate(viewer.userId, row),
      ),
    ),
  );
}

function interactionPredicate(
  viewer: PolicyViewer,
  capability: Exclude<Capability, "read" | "discover">,
  row: MessageAccessRow,
) {
  if (capability === "reply") return replyPredicate(viewer, row);
  if (viewer.userId === null) return sql`0`;
  return all(
    ordinaryReadPredicate(viewer, row),
    eq(row.deleted, 0),
    eq(row.moderationState, "published"),
    noMessageBlock(viewer.userId, row),
  );
}

function ancestorsAllow(predicate: SQL) {
  return all(
    sql`(
      ${messages.parentId} IS NULL
      OR EXISTS (
        SELECT 1 FROM ${messages} AS ${sql.identifier("access_ancestor")}
        WHERE ${accessAncestor.id} = ${messages.parentId}
          AND COALESCE((${predicate}), 0)
      )
    )`,
    sql`(
      ${messages.rootId} IS NULL
      OR EXISTS (
        SELECT 1 FROM ${messages} AS ${sql.identifier("access_ancestor")}
        WHERE ${accessAncestor.id} = ${messages.rootId}
          AND COALESCE((${predicate}), 0)
      )
    )`,
  );
}

function withAncestorIntersection(
  current: SQL,
  ancestor: SQL,
) {
  return all(current, ancestorsAllow(ancestor));
}

export function buildMessageAccessPredicate(viewer: PolicyViewer, surface: Surface) {
  const useRead = surface === "thread" || surface === "bookmarks";
  if (useRead) {
    return withAncestorIntersection(
      readPredicate(viewer, messages),
      readPredicate(viewer, accessAncestor),
    );
  }
  return withAncestorIntersection(
    discoveryPredicate(viewer, surface, messages),
    discoveryPredicate(viewer, surface, accessAncestor),
  );
}

export function visibleMessageWhere(viewer: PolicyViewer, surface: Surface) {
  return buildMessageAccessPredicate(viewer, surface);
}

export function visibleThreadWhere(viewer: PolicyViewer, rootId: number) {
  return all(
    any(eq(messages.id, rootId), eq(messages.rootId, rootId)),
    buildMessageAccessPredicate(viewer, "thread"),
  );
}

export function buildMessageCapabilityPredicate(
  viewer: PolicyViewer,
  capability: Exclude<Capability, "read" | "discover">,
) {
  return withAncestorIntersection(
    interactionPredicate(viewer, capability, messages),
    interactionPredicate(viewer, capability, accessAncestor),
  );
}
import { and, eq, or, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { blocks, follows, messages, mutes } from "../db/schema";
