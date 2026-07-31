"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import Link from "next/link";

export default function Settings() {
  const [userId, setUserId] = useState("");
  const [wallpaperUrl, setWallpaperUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadSettings() {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUserId(data.user.id);

        const { data: profile } = await supabase
          .from("profiles")
          .select("wallpaper_url")
          .eq("id", data.user.id)
          .maybeSingle();

        if (profile?.wallpaper_url) {
          setWallpaperUrl(profile.wallpaper_url);
        }
      }
    }
    loadSettings();
  }, []);

  async function handleWallpaperSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setUploading(true);
    setMessage("");

    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("wallpapers")
      .upload(fileName, file);

    if (uploadError) {
      setMessage("Upload failed: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("wallpapers")
      .getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ wallpaper_url: urlData.publicUrl })
      .eq("id", userId);

    if (updateError) {
      setMessage("Could not save wallpaper.");
    } else {
      setWallpaperUrl(urlData.publicUrl);
      setMessage("Chat wallpaper updated!");
    }

    setUploading(false);
  }

  async function resetWallpaper() {
    await supabase
      .from("profiles")
      .update({ wallpaper_url: null })
      .eq("id", userId);

    setWallpaperUrl("");
    setMessage("Reset to default wallpaper.");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-16">
      <div className="bg-zinc-900 p-4">
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      <div className="p-4">
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">Chat Wallpaper</h2>

        <div className="bg-zinc-900 rounded-xl p-4">
          <div
            className="w-full h-40 rounded-lg bg-zinc-800 bg-cover bg-center mb-3 flex items-center justify-center"
            style={
              wallpaperUrl
                ? { backgroundImage: `url("${wallpaperUrl}")` }
                : {}
            }
          >
            {!wallpaperUrl && (
              <span className="text-zinc-500 text-xs">Default wallpaper</span>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleWallpaperSelect}
          />

          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg text-sm"
            >
              {uploading ? "Uploading…" : "Choose Photo"}
            </button>
            {wallpaperUrl && (
              <button
                onClick={resetWallpaper}
                className="px-4 border border-zinc-700 text-zinc-300 rounded-lg text-sm hover:bg-zinc-800"
              >
                Reset
              </button>
            )}
          </div>

          {message && (
            <p className="text-xs text-zinc-400 mt-2">{message}</p>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 flex justify-around py-2">
        <Link href="/chat" className="flex flex-col items-center text-xs text-zinc-400">
          <span className="text-lg">💬</span>
          Chats
        </Link>
        <Link href="/contacts" className="flex flex-col items-center text-xs text-zinc-400">
          <span className="text-lg">👥</span>
          Contacts
        </Link>
        <Link href="/settings" className="flex flex-col items-center text-xs text-blue-500">
          <span className="text-lg">⚙️</span>
          Settings
        </Link>
        <Link href="/profile" className="flex flex-col items-center text-xs text-zinc-400">
          <span className="text-lg">👤</span>
          Profile
        </Link>
      </div>
    </div>
  );
}