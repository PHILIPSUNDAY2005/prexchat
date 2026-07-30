"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../supabaseClient";
import ChatBackground from "../ChatBackground";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleLogin() {
    if (!email || !password) {
      setMessage("Please fill in all fields!");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      router.push("/chat");
    }
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden bg-[#0B1120]">
      <ChatBackground />

      <div className="relative z-10 bg-zinc-900 p-6 rounded-xl shadow-lg w-80 text-center">
        <h1 className="text-2xl font-bold text-white mb-1">
          ChitChat<span className="text-blue-500">NG</span>
        </h1>
        <p className="text-zinc-400 text-sm mb-4">Log in to your account</p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 rounded-lg mb-3 text-sm outline-none"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 rounded-lg mb-3 text-sm outline-none"
        />
        <button
          onClick={handleLogin}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg text-sm"
        >
          Log in
        </button>

        {message && (
          <p className="text-zinc-300 text-xs mt-3">{message}</p>
        )}

        <p className="text-zinc-400 text-xs mt-4">
          Don't have an account?{" "}
          <Link href="/signup" className="text-blue-500 font-semibold hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}