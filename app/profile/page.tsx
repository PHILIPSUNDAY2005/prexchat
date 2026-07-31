"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import Link from "next/link";

export default function Profile() {
  const [userId, setUserId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUserId(data.user.id);

        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, username, avatar_url")
          .eq("id", data.user.id)
          .maybeSingle();

        if (profile) {
          setFirstName(profile.first_name || "");
          setUsername(profile.username || "");
          setAvatarUrl(profile.avatar_url || "");
        }
      }
    }
    loadProfile();
  }, []);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setUploading(true);
    setMessage("");

    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, file);

    if (uploadError) {
      setMessage("Upload failed: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: urlData.publicUrl })
      .eq("id", userId);

    if (updateError) {
      setMessage("Could not save profile picture.");
    } else {
      setAvatarUrl(urlData.publicUrl);
      setMessage("Profile picture updated!");
    }

    setUploading(false);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-16">
      <div className="bg-zinc-900 p-4">
        <h1 className="text-xl font-bold">Profile</h1>
      </div>

      <div className="flex flex-col items-center pt-10 px-6">
        <div
          className="relative w-28 h-28 rounded-full bg-blue-500 flex items-center justify-center text-4xl font-bold cursor-pointer overflow-hidden"
          onClick={() => fileInputRef.current?.click()}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            firstName?.charAt(0) || "?"
          )}

          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center text-xs transition-opacity">
            {uploading ? "Uploading…" : "Change"}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="mt-3 text-xs text-blue-500 hover:underline"
        >
          {uploading ? "Uploading…" : "Change profile picture"}
        </button>

        {message && (
          <p className="text-xs text-zinc-400 mt-2">{message}</p>
        )}

        <h2 className="text-xl font-bold mt-6">{firstName}</h2>
        <p className="text-sm text-zinc-500">@{username}</p>
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
        <Link href="/settings" className="flex flex-col items-center text-xs text-zinc-400">
          <span className="text-lg">⚙️</span>
          Settings
        </Link>
        <Link href="/profile" className="flex flex-col items-center text-xs text-blue-500">
          <span className="text-lg">👤</span>
          Profile
        </Link>
      </div>
    </div>
  );
}