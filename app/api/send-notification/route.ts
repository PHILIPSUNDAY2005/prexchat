import { NextResponse } from "next/server";
import * as webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { receiverId, title, body, url } = await req.json();

    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", receiverId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    for (const row of subscriptions || []) {
      try {
        await webpush.sendNotification(
          row.subscription,
          JSON.stringify({
            title,
            body,
            url,
          })
        );
      } catch (err) {
        console.error("Push notification failed:", err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}