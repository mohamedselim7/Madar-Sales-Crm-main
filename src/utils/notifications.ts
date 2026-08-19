import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/src/lib/firebase";

export interface SystemNotificationPayload {
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | "client" | "lead" | "task" | "system";
  category?: string;
  link?: string;
  triggeredBy?: string;
}

/**
 * Synthesizes credit-level chime audio utilizing natural Web Audio API.
 * No external file dependencies, ensuring flawless operation in sandbox/offline.
 */
export function playNotificationSound() {
  // Completely disabled per user request
  return;
}

/**
 * Fires a notification into Firestore.
 */
export async function sendSystemNotification({
  title,
  message,
  type,
  category = "general",
  link = "",
  triggeredBy = "السيستم"
}: SystemNotificationPayload) {
  // Completely disabled per user request
  return;
}
