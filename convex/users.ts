import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Check if a user is authorized (userType is not "blocked")
export const isAuthorized = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (!user) return false;
    // User is authorized unless explicitly blocked
    return user.userType !== "blocked";
  },
});

// Get user by email (for display purposes)
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
  },
});

// Ensure user exists in database (creates if not, called on page load)
export const ensureUser = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const email = identity.email;
    if (!email) {
      throw new Error("No email in identity");
    }

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existingUser) {
      return existingUser;
    }

    // Create new user with blocked status
    const userId = await ctx.db.insert("users", {
      email,
      name: identity.name ?? undefined,
      userType: "blocked",
      createdAt: Date.now(),
    });

    return await ctx.db.get(userId);
  },
});
