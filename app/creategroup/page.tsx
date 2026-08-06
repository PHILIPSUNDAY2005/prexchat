"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabaseClient";

type Contact = {
  id: string;
  first_name: string;
  username: string;
  avatar_url: string | null;
};

export default function CreateGroup() {
  const router = useRouter();
  const [groupName, setGroupName] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("contacts")
      .select("contact_id, profiles:contact_id(id, first_name, username, avatar_url)")
      .eq("user_id", user.id);

    if (data) {
      const list = data
        .map((row: any) => row.profiles)
        .filter(Boolean);
      setContacts(list);
    }
  }

  function toggleContact(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleCreateGroup() {
    if (!groupName.trim()) {
      setError("Please enter a group name.");
      return;
    }
    if (selected.length < 1) {
      setError("Select at least one contact.");
      return;
    }

    setError("");
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const newGroupId = crypto.randomUUID();

    const { error: groupError } = await supabase
      .from("groups")
      .insert({ id: newGroupId, name: groupName.trim(), created_by: user.id });

    if (groupError) {
      setError(groupError.message);
      setLoading(false);
      return;
    }

    const members = [
      { group_id: newGroupId, user_id: user.id, role: "admin" },
      ...selected.map((id) => ({ group_id: newGroupId, user_id: id, role: "member" })),
    ];

    const { error: memberError } = await supabase
      .from("group_members")
      .insert(members);

    setLoading(false);

    if (memberError) {
      setError(memberError.message);
      return;
    }

    router.push(`/groupchat/${newGroupId}`);
  }

  return (
    <div className="min-h-screen bg-[#0B1120] text-white px-4 py-6">
      <h1 className="text-xl font-bold mb-4">Create Group</h1>

      <label className="block text-xs text-zinc-300 mb-1">Group Name</label>
      <input
        type="text"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
        placeholder="e.g. Study Squad"
        className="w-full p-2 rounded-lg text-sm outline-none mb-4 text-black"
      />

      <label className="block text-xs text-zinc-300 mb-2">Select Contacts</label>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {contacts.map((c) => (
          <div
            key={c.id}
            onClick={() => toggleContact(c.id)}
            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${
              selected.includes(c.id) ? "bg-blue-600" : "bg-zinc-800"
            }`}
          >
            <div className="w-9 h-9 rounded-full bg-zinc-600 overflow-hidden flex items-center justify-center text-sm">
              {c.avatar_url ? (
                <img src={c.avatar_url} className="w-full h-full object-cover" />
              ) : (
                c.first_name?.[0]?.toUpperCase()
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{c.first_name}</p>
              <p className="text-xs text-zinc-400">@{c.username}</p>
            </div>
          </div>
        ))}
        {contacts.length === 0 && (
          <p className="text-zinc-500 text-sm">No contacts yet. Add some first.</p>
        )}
      </div>

      {error && <p className="text-red-400 text-xs mt-3">{error}</p>}

      <button
        onClick={handleCreateGroup}
        disabled={loading}
        className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white p-2 rounded-lg text-sm mt-5"
      >
        {loading ? "Creating…" : "Create Group"}
      </button>
    </div>
  );
}