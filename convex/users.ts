import { query } from "./_generated/server";
import { v } from "convex/values";

// Check if a user is authorized (userType is "user" or "admin")
export const isAuthorized = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (!user) return false;
    // User must have userType "user" or "admin" to be authorized
    return user.userType === "user" || user.userType === "admin";
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
