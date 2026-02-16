import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { EventEnvelope } from "../types";

export async function subscribeToLyricVaultEvents(
  handler: (event: EventEnvelope) => void,
): Promise<UnlistenFn> {
  return listen<EventEnvelope>("lyricvault:event", (event) => {
    if (event.payload && typeof event.payload === "object") {
      handler(event.payload);
    }
  });
}
