"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import Link from "next/link";

export default function Profile() {
  const [userId, setUserId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [username, setUsername] = useState("");
  const [about, setAbout] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const [editingName, setEditingName] = useState(false);
  const [editingAbout, setEditingAbout] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [aboutDraft, setAboutDraft] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUserId(data.user.id);
        setPhone(data.user.phone || data.user.email || "");

        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, username, avatar_url, about")
          .eq("id", data.user.id)
          .maybeSingle();

        if (profile) {
          setFirstName(profile.first_name || "");
          setUsername(profile.username || "");
          setAvatarUrl(profile.avatar_url || "");
          setAbout(profile.about || "Hey there! I am using ChitChat NG.");
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

  async function saveName() {
    if (!nameDraft.trim()) {
      setEditingName(false);
      return;
    }
    await supabase.from("profiles").update({ first_name: nameDraft.trim() }).eq("id", userId);
    setFirstName(nameDraft.trim());
    setEditingName(false);
  }

  async function saveAbout() {
    const value = aboutDraft.trim() || "Hey there! I am using ChitChat NG.";
    await supabase.from("profiles").update({ about: value }).eq("id", userId);
    setAbout(value);
    setEditingAbout(false);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-16">
      <div className="bg-zinc-900 p-4 flex items-center gap-3">
        <Link href="/chat" className="text-lg">←</Link>
        <h1 className="text-xl font-bold">Profile</h1>
      </div>

      <div className="flex flex-col items-center pt-8 pb-6 border-b border-zinc-800">
        <div
          className="relative w-28 h-28 rounded-full bg-blue-500 flex items-center justify-center text-4xl font-bold cursor-pointer overflow-hidden"
          onClick={() => fileInputRef.current?.click()}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            firstName?.charAt(0) || "?"
          )}
          <div className="absolute bottom-0 right-0 bg-green-500 w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 border-zinc-950">
            📷
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        {uploading && <p className="text-xs text-zinc-400 mt-2">Uploading…</p>}
        {message && !uploading && <p className="text-xs text-zinc-400 mt-2">{message}</p>}
      </div>

      <div className="divide-y divide-zinc-800">
        <div className="px-5 py-4">
          <p className="text-xs text-zinc-500 mb-1">Name</p>
          {editingName ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="flex-1 bg-zinc-800 rounded-lg p-2 text-sm outline-none"
              />
              <button onClick={saveName} className="text-blue-500 text-sm px-2">Save</button>
            </div>
          ) : (
            <p
              className="text-base cursor-pointer"
              onClick={() => {
                setNameDraft(firstName);
                setEditingName(true);
              }}
            >
              {firstName}
            </p>
          )}
        </div>

        <div className="px-5 py-4">
          <p className="text-xs text-zinc-500 mb-1">About</p>
          {editingAbout ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={aboutDraft}
                onChange={(e) => setAboutDraft(e.target.value)}
                className="flex-1 bg-zinc-800 rounded-lg p-2 text-sm outline-none"
              />
              <button onClick={saveAbout} className="text-blue-500 text-sm px-2">Save</button>
            </div>
          ) : (
            <p
              className="text-base cursor-pointer"
              onClick={() => {
                setAboutDraft(about);
                setEditingAbout(true);
              }}
            >
              {about}
            </p>
          )}
        </div>

        <div className="px-5 py-4">
          <p className="text-xs text-zinc-500 mb-1">Reserved username</p>
          <p className="text-base text-zinc-300">{username}</p>
        </div>

        {phone && (
          <div className="px-5 py-4">
            <p className="text-xs text-zinc-500 mb-1">Contact</p>
            <p className="text-base text-zinc-300">{phone}</p>
          </div>
        )}
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