"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../supabaseClient";
import ChatBackground from "../ChatBackground";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setError("");
    setLoading(true);

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (loginError) {
      setError(loginError.message);
    } else {
      router.push("/chat");
    }
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden bg-[#0B1120] px-6">
      <ChatBackground />

      <div className="relative z-10 bg-zinc-900 p-6 rounded-xl shadow-lg w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-1 text-center">
          ChitChat<span className="text-blue-500">NG</span>
        </h1>
        <p className="text-zinc-400 text-sm mb-6 text-center">Log in to your account</p>

        <label className="block text-sm text-zinc-300 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full p-3 rounded-lg text-sm outline-none mb-4 bg-white text-black placeholder-zinc-500 border border-zinc-300 focus:border-blue-500"
        />

        <label className="block text-sm text-zinc-300 mb-1">Password</label>
        <div className="relative mb-2">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="w-full p-3 rounded-lg text-sm outline-none bg-white text-black placeholder-zinc-500 border border-zinc-300 focus:border-blue-500 pr-14"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-medium"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        {error && <p className="text-red-400 text-xs mt-2 mb-2">{error}</p>}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white p-3 rounded-lg text-sm font-medium mt-4 flex items-center justify-center gap-2"
        >
          {loading && (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {loading ? "Logging in…" : "Log in"}
        </button>

        <p className="text-zinc-400 text-xs mt-5 text-center">
          Don't have an account?{" "}
          <Link href="/signup" className="text-blue-500 font-semibold hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}