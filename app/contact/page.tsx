"use client";

import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Link from "next/link";

export default function Contacts() {
  const [userId, setUserId] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [myContacts, setMyContacts] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function getUser() {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUserId(data.user.id);
        loadMyContacts(data.user.id);
      }
    }
    getUser();
  }, []);

  async function loadMyContacts(myId: string) {
    const { data } = await supabase
      .from("contacts")
      .select("contact_id, profiles:contact_id(id, first_name, username)")
      .eq("user_id", myId);

    setMyContacts(data || []);
  }

  async function handleSearch() {
    if (!search) {
      setResults([]);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, username")
      .ilike("username", `%${search.toLowerCase()}%`)
      .neq("id", userId);

    setResults(data || []);
  }

  async function addContact(contact: { id: string; first_name: string }) {
    const { error } = await supabase.from("contacts").insert({
      user_id: userId,
      contact_id: contact.id,
    });

    if (error) {
      setMessage("Could not add — maybe already in your contacts.");
    } else {
      setMessage(`${contact.first_name} added!`);
      loadMyContacts(userId);
    }
  }

  async function removeContact(contactId: string) {
    await supabase
      .from("contacts")
      .delete()
      .eq("user_id", userId)
      .eq("contact_id", contactId);

    loadMyContacts(userId);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-16">
      <div className="bg-zinc-900 p-4">
        <h1 className="text-xl font-bold mb-3">Contacts</h1>
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username"
            className="flex-1 p-2 rounded-lg text-sm outline-none bg-zinc-800 text-white"
          />
          <button
            onClick={handleSearch}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 rounded-lg text-sm"
          >
            Search
          </button>
        </div>
      </div>

      {message && (
        <p className="text-xs text-zinc-400 px-4 pt-3">{message}</p>
      )}

      {results.length > 0 && (
        <div className="px-4 pt-4">
          <p className="text-xs text-zinc-500 mb-2">Search results</p>
          {results.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between py-2 border-b border-zinc-800"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center font-bold text-sm">
                  {r.first_name?.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold">{r.first_name}</p>
                  <p className="text-xs text-zinc-500">@{r.username}</p>
                </div>
              </div>
              <button
                onClick={() => addContact(r)}
                className="text-xs bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded-lg"
              >
                Add
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 pt-6">
        <p className="text-xs text-zinc-500 mb-2">Your contacts</p>
        {myContacts.length === 0 && (
          <p className="text-zinc-500 text-sm">
            No contacts yet — search a username above to add someone.
          </p>
        )}
        {myContacts.map((c) => (
          <div
            key={c.contact_id}
            className="flex items-center justify-between py-2 border-b border-zinc-800"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center font-bold text-sm">
                {c.profiles?.first_name?.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold">{c.profiles?.first_name}</p>
                <p className="text-xs text-zinc-500">@{c.profiles?.username}</p>
              </div>
            </div>
            <button
              onClick={() => removeContact(c.contact_id)}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 flex justify-around py-2">
        <Link href="/chat" className="flex flex-col items-center text-xs text-zinc-400">
          <span className="text-lg">💬</span>
          Chats
        </Link>
        <Link href="/contacts" className="flex flex-col items-center text-xs text-blue-500">
          <span className="text-lg">👥</span>
          Contacts
        </Link>
        <Link href="/settings" className="flex flex-col items-center text-xs text-zinc-400">
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