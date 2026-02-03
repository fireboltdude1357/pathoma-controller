import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Send a command (requires authenticated user)
export const send = mutation({
  args: {
    type: v.union(
      v.literal("play"),
      v.literal("pause"),
      v.literal("seekForward"),
      v.literal("seekBackward"),
      v.literal("speedUp"),
      v.literal("speedDown")
    ),
    amount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get or create user
    const email = identity.email;
    if (!email) {
      throw new Error("No email in identity");
    }

    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    // Auto-create user if they don't exist (defaults to blocked)
    if (!user) {
      const userId = await ctx.db.insert("users", {
        email,
        name: identity.name ?? undefined,
        userType: "blocked",
        createdAt: Date.now(),
      });
      user = await ctx.db.get(userId);
    }

    // Check if user is authorized (must not be "blocked")
    if (user?.userType === "blocked") {
      throw new Error("Not authorized. Your account is pending approval.");
    }

    // Create command
    const commandId = await ctx.db.insert("commands", {
      type: args.type,
      amount: args.amount,
      userId: identity.subject,
      createdAt: Date.now(),
      acknowledged: false,
    });

    return commandId;
  },
});

// Get latest unacknowledged command (for extension polling/subscription)
export const getLatestUnacknowledged = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("commands")
      .withIndex("by_createdAt")
      .filter((q) => q.eq(q.field("acknowledged"), false))
      .order("desc")
      .first();
  },
});

// Acknowledge a command (called by extension after execution)
export const acknowledge = mutation({
  args: { commandId: v.id("commands") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.commandId, {
      acknowledged: true,
      acknowledgedAt: Date.now(),
    });
  },
});

// Get recent commands (for debugging/UI)
export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    return await ctx.db
      .query("commands")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);
  },
});
