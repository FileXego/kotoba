import { describe, expect, it } from "bun:test";
import {
  decideMessageAccess,
  deriveAudienceAnchor,
  type AccessContext,
  type AccessDecision,
  type Surface,
} from "../../src/lib/message-access";

function context(overrides: Partial<AccessContext> = {}): AccessContext {
  return {
    viewer: { userId: null, isReviewer: false },
    surface: "garden",
    message: {
      authorId: 1,
      audienceAnchorUserId: 1,
      visibility: "public",
      moderationState: "published",
      replyPolicy: "viewer",
      deleted: false,
    },
    relationship: {
      viewerFollowsAuthor: false,
      viewerFollowsAnchor: false,
      anchorFollowsViewer: false,
      viewerMutesAuthor: false,
      blockedEitherDirection: false,
    },
    ancestors: [],
    ...overrides,
  };
}

function inaccessible(): AccessDecision {
  return {
    mayRead: false,
    mayDiscover: false,
    mayReply: false,
    mayReact: false,
    mayMention: false,
  };
}

describe("message access decision matrix", () => {
  it("keeps public writing readable while requiring login for interaction", () => {
    expect(decideMessageAccess(context())).toEqual({
      mayRead: true,
      mayDiscover: true,
      mayReply: false,
      mayReact: false,
      mayMention: false,
    });

    const signedIn = decideMessageAccess(context({ viewer: { userId: 2, isReviewer: false } }));
    expect(signedIn).toMatchObject({
      mayRead: true,
      mayDiscover: true,
      mayReply: true,
      mayReact: true,
      mayMention: true,
    });
  });

  it("maps publication distribution to every read surface", () => {
    const cases: Array<[Surface, boolean]> = [
      ["garden", true],
      ["following", true],
      ["profile", true],
      ["thread", true],
      ["search", true],
      ["bookmarks", true],
      ["activity", true],
    ];
    for (const [surface, expected] of cases) {
      const decision = decideMessageAccess(context({
        surface,
        viewer: { userId: 2, isReviewer: false },
        relationship: {
          ...context().relationship,
          viewerFollowsAuthor: true,
        },
      }));
      expect(decision.mayDiscover).toBe(expected);
    }
  });

  it("keeps quiet-public writing out of garden and search but in following and profile", () => {
    const message = { ...context().message, visibility: "quiet_public" as const };
    expect(decideMessageAccess(context({ surface: "garden", message })).mayRead).toBe(true);
    expect(decideMessageAccess(context({ surface: "garden", message })).mayDiscover).toBe(false);
    expect(decideMessageAccess(context({ surface: "search", message })).mayDiscover).toBe(false);
    expect(decideMessageAccess(context({ surface: "profile", message })).mayDiscover).toBe(true);
    expect(decideMessageAccess(context({
      surface: "following",
      viewer: { userId: 2, isReviewer: false },
      message,
      relationship: { ...context().relationship, viewerFollowsAuthor: true },
    }))).toMatchObject({ mayRead: true, mayDiscover: true });
  });

  it("derives acquaintance from reciprocal follows to the audience anchor", () => {
    const acquaintanceMessage = {
      ...context().message,
      authorId: 3,
      audienceAnchorUserId: 1,
      visibility: "acquaintance" as const,
    };
    const oneWay = decideMessageAccess(context({
      surface: "profile",
      viewer: { userId: 2, isReviewer: false },
      message: acquaintanceMessage,
      relationship: { ...context().relationship, viewerFollowsAnchor: true },
    }));
    expect(oneWay).toEqual(inaccessible());

    const reciprocal = decideMessageAccess(context({
      surface: "profile",
      viewer: { userId: 2, isReviewer: false },
      message: acquaintanceMessage,
      relationship: {
        ...context().relationship,
        viewerFollowsAnchor: true,
        anchorFollowsViewer: true,
      },
    }));
    expect(reciprocal).toMatchObject({ mayRead: true, mayDiscover: true });
  });

  it("keeps private writing author-only", () => {
    const message = { ...context().message, visibility: "private" as const };
    expect(decideMessageAccess(context({ viewer: { userId: 2 }, message }))).toEqual(inaccessible());
    expect(decideMessageAccess(context({
      viewer: { userId: 1 },
      surface: "profile",
      message,
    }))).toMatchObject({
      mayRead: true,
      mayDiscover: true,
    });
    expect(decideMessageAccess(context({
      viewer: { userId: 9, isReviewer: true },
      surface: "thread",
      message,
    }))).toMatchObject({ mayRead: true, mayDiscover: false });
  });

  it("lets mute suppress ambient discovery without becoming confidentiality", () => {
    const muted = {
      ...context().relationship,
      viewerMutesAuthor: true,
      viewerFollowsAuthor: true,
    };
    expect(decideMessageAccess(context({
      viewer: { userId: 2 },
      surface: "garden",
      relationship: muted,
    }))).toMatchObject({ mayRead: true, mayDiscover: false });
    expect(decideMessageAccess(context({
      viewer: { userId: 2 },
      surface: "thread",
      relationship: muted,
    }))).toMatchObject({ mayRead: true, mayDiscover: true });
  });

  it("makes block a discovery and interaction boundary without making public data secret", () => {
    const blocked = decideMessageAccess(context({
      viewer: { userId: 2 },
      surface: "thread",
      relationship: { ...context().relationship, blockedEitherDirection: true },
    }));
    expect(blocked).toEqual({
      mayRead: true,
      mayDiscover: false,
      mayReply: false,
      mayReact: false,
      mayMention: false,
    });
    expect(decideMessageAccess(context()).mayDiscover).toBe(true);
  });

  it("limits held, removed, and author-deleted writing to review-safe reads", () => {
    const held = { ...context().message, moderationState: "held" as const };
    expect(decideMessageAccess(context({ viewer: { userId: 1 }, message: held }))).toMatchObject({
      mayRead: true,
      mayDiscover: false,
      mayReply: false,
    });
    expect(decideMessageAccess(context({ viewer: { userId: 2 }, message: held }))).toEqual(inaccessible());
    expect(decideMessageAccess(context({ viewer: { userId: 9, isReviewer: true }, message: held })))
      .toMatchObject({ mayRead: true, mayDiscover: false });

    for (const message of [
      { ...context().message, moderationState: "removed" as const },
      { ...context().message, deleted: true },
    ]) {
      expect(decideMessageAccess(context({ viewer: { userId: 1 }, message }))).toEqual(inaccessible());
      expect(decideMessageAccess(context({ viewer: { userId: 9, isReviewer: true }, message })))
        .toMatchObject({ mayRead: true, mayDiscover: false });
    }
  });

  it("applies root reply policy after visibility and relationship checks", () => {
    const acquaintanceOnly = { ...context().message, replyPolicy: "acquaintance" as const };
    expect(decideMessageAccess(context({
      viewer: { userId: 2 },
      message: acquaintanceOnly,
      relationship: { ...context().relationship, viewerFollowsAnchor: true },
    })).mayReply).toBe(false);
    expect(decideMessageAccess(context({
      viewer: { userId: 2 },
      message: acquaintanceOnly,
      relationship: {
        ...context().relationship,
        viewerFollowsAnchor: true,
        anchorFollowsViewer: true,
      },
    })).mayReply).toBe(true);
    expect(decideMessageAccess(context({
      viewer: { userId: 2 },
      message: { ...context().message, replyPolicy: "closed" },
    })).mayReply).toBe(false);
  });

  it("allows ancestor decisions to narrow but never widen a child", () => {
    const publicAncestor = decideMessageAccess(context({ surface: "thread" }));
    expect(decideMessageAccess(context({
      surface: "thread",
      viewer: { userId: 2 },
      message: { ...context().message, visibility: "private" },
      ancestors: [publicAncestor],
    }))).toEqual(inaccessible());

    expect(decideMessageAccess(context({
      surface: "thread",
      viewer: { userId: 2 },
      ancestors: [inaccessible()],
    }))).toEqual(inaccessible());
  });

  it("inherits the audience anchor from the root boundary", () => {
    expect(deriveAudienceAnchor(null, 7, "public")).toBe(7);
    expect(deriveAudienceAnchor({ authorId: 3, audienceAnchorUserId: 2 }, 7, "private")).toBe(2);
    expect(deriveAudienceAnchor({ authorId: 3, audienceAnchorUserId: null }, 7, "public")).toBe(3);
  });
});
