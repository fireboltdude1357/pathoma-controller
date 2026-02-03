# Convex Backend - Pathoma Controller

## Schema Overview

### `users` table
Authorized users who can send video commands.

| Field | Type | Description |
|-------|------|-------------|
| email | string | User's email (indexed for lookup) |
| name | string? | Optional display name |
| createdAt | number | Unix timestamp of creation |

**Index:** `by_email` - Fast email lookup for authorization

**Authorization Model:** Admin manually adds authorized email addresses directly in the Convex dashboard. When a user signs in via Clerk, their email is checked against this table.

### `commands` table
Video control commands sent from the web app to the browser extension.

| Field | Type | Description |
|-------|------|-------------|
| type | union | Command type: play, pause, seekForward, seekBackward, speedUp, speedDown |
| amount | number? | Optional: seconds for seek, delta for speed |
| userId | string | Clerk user ID who sent the command |
| createdAt | number | Unix timestamp for ordering |
| acknowledged | boolean | Has extension processed this command? |
| acknowledgedAt | number? | When extension acknowledged |

**Index:** `by_createdAt` - Fetch recent commands in order

## Usage

Commands flow:
1. Web app sends command via Convex mutation
2. Extension polls for unacknowledged commands via Convex query
3. Extension executes command on video element
4. Extension acknowledges command via Convex mutation

## Functions (Added in Plan 02)

- `commands.send` - Mutation to create new command
- `commands.getLatest` - Query for unacknowledged commands
- `commands.acknowledge` - Mutation to mark command processed
- `users.isAuthorized` - Query to check email authorization
