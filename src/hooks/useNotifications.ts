import { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch, 
  serverTimestamp,
  arrayUnion,
  getDocs,
  limit
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { useAuth } from "@/src/context/AuthContext";
import { useUserRole } from "@/src/hooks/useUserRole";
import { playNotificationSound } from "@/src/utils/notifications";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | "client" | "lead" | "task" | "system";
  createdAt: any;
  readBy: string[];
  category?: string;
  link?: string;
  triggeredBy?: string;
}

export function useNotifications() {
  // Completely disabled per user request to turn off and remove the notification system
  const notifications: AppNotification[] = [];
  const unreadCount = 0;
  const loading = false;

  const markAsRead = async (id: string) => {};
  const markAllAsRead = async () => {};
  const deleteNotification = async (id: string) => {};
  const clearAllNotifications = async () => {};
  const sendNotification = async (
    title: string,
    message: string,
    type: AppNotification["type"] = "info",
    category: string = "general",
    link: string = ""
  ) => {};
  const triggerTestNotification = async () => {};

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    sendNotification,
    triggerTestNotification
  };
}
