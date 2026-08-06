import { supabase } from "./supabaseClient";
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export async function enableNotifications(userId) {
 console.log(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
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

 const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

if (!publicKey) {
  throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing");
}

const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(publicKey),
});
  await supabase.from("push_subscriptions").insert({
    user_id: userId,
    subscription: subscription,
  });

  console.log("ChitChat NG notifications enabled ✅");
}