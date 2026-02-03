import { ConvexClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';

// Convex URL injected at build time
declare const process: { env: { CONVEX_URL: string } };
const CONVEX_URL = process.env.CONVEX_URL;

let client: ConvexClient | null = null;

export function getConvexClient(): ConvexClient {
  if (!client) {
    if (!CONVEX_URL) {
      throw new Error('CONVEX_URL not configured');
    }
    client = new ConvexClient(CONVEX_URL);
  }
  return client;
}

export function subscribeToCommands(
  onCommand: (command: any) => void
): () => void {
  const convex = getConvexClient();

  // Subscribe to latest unacknowledged command
  const unsubscribe = convex.onUpdate(
    api.commands.getLatestUnacknowledged,
    {},
    (command) => {
      if (command) {
        console.log('[Pathoma Controller] Command received:', command);
        onCommand(command);
      }
    }
  );

  return unsubscribe;
}

export async function acknowledgeCommand(commandId: Id<"commands">): Promise<void> {
  const convex = getConvexClient();
  await convex.mutation(api.commands.acknowledge, { commandId });
}

export { api };
