import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import {
  doc,
  getDocFromServer,
  initializeFirestore,
  setLogLevel
} from "firebase/firestore";
import firebaseConfig from "@/firebase-applet-config.json";

// Config comes from firebase-applet-config.json (checked into the repo —
// these are Firebase web app keys, not secrets; access is controlled by
// Firestore security rules, not by hiding this file). This file is bundled
// directly by Vite, so it's always present in the build with no extra
// deploy step — unlike VITE_* env vars, which only work if they're set
// BEFORE `vite build` runs, which this host does not guarantee.
const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId || "(default)";

const app = initializeApp(firebaseConfig);

// Initialize Firestore using initializeFirestore with force long polling for iframe sandbox compatibility
setLogLevel("silent");

export const db = initializeFirestore(
  app,
  { experimentalForceLongPolling: true },
  FIRESTORE_DATABASE_ID
);

export const auth = getAuth(app);
export const storage = getStorage(app);

// Connectivity check as required by Firebase integration guidelines
async function testConnection() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    console.warn("Firestore is running in offline mode. Skipping server connectivity verification.");
    return;
  }
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    console.log("Firestore connection verified.");
  } catch (error: any) {
    const isOffline = error instanceof Error && (
      error.message.includes("offline") ||
      error.message.includes("the client is offline") ||
      error.message.includes("unavailable")
    );
    if (isOffline) {
      console.warn("Firestore is running in offline mode. Please verify configuration or internet access for synchronization.");
    } else {
      console.info("Firestore bootstrap connectivity check:", error.message || error);
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
    },
  };
  console.error(`[Firestore ${operationType}] ${path ?? ""}:`, errInfo.error, errInfo.authInfo);
}

export function convertTimestamps<T>(data: any): T {
  return data as T;
}