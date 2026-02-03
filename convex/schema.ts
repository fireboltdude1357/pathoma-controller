import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Authorized users - admin adds emails directly in Convex dashboard
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    // User type: "blocked" (default), "user", or "admin"
    // Only "user" and "admin" can access the control page
    userType: v.optional(v.union(v.literal("blocked"), v.literal("user"), v.literal("admin"))),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  // Video control commands sent from web app
  commands: defineTable({
    type: v.union(
      v.literal("play"),
      v.literal("pause"),
      v.literal("seekForward"),
      v.literal("seekBackward"),
      v.literal("speedUp"),
      v.literal("speedDown")
    ),
    // Amount for seek (seconds) or speed change (playbackRate delta)
    amount: v.optional(v.number()),
    // Who sent the command (Clerk user ID)
    userId: v.string(),
    // Timestamp for ordering and deduplication
    createdAt: v.number(),
    // Extension acknowledgment
    acknowledged: v.boolean(),
    acknowledgedAt: v.optional(v.number()),
  }).index("by_createdAt", ["createdAt"]),
});
