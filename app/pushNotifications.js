import { supabase } from "./supabaseClient";

export async function enableNotifications(userId) {
  if (!("serviceWorker" in navigator)) {
    console.log("Service Worker not supported");
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    console.log("Notification permission denied");
    return;
  }

  const registration = await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });

  await supabase.from("push_subscriptions").insert({
    user_id: userId,
    subscription: subscription,
  });

  console.log("ChitChat NG notifications enabled ✅");
}