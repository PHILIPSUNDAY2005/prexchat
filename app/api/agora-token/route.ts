import { NextRequest, NextResponse } from "next/server";
import { RtcTokenBuilder, RtcRole } from "agora-token";

export async function GET(request: NextRequest) {
  const channelName = request.nextUrl.searchParams.get("channel");

  if (!channelName) {
    return NextResponse.json({ error: "channel is required" }, { status: 400 });
  }

  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID as string;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE as string;

  const uid = 0;
  const role = RtcRole.PUBLISHER;
  const expirationTimeInSeconds = 3600;

  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    role,
    expirationTimeInSeconds,
    expirationTimeInSeconds
  );
  return NextResponse.json({ token });
}