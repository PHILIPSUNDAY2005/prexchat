import Link from "next/link";
import ChatBackground from "./ChatBackground";

export default function Home() {
  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden bg-[#0B1120]">
      <ChatBackground />

      <div className="relative z-10 text-center px-6">
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
          ChitChat<span className="text-blue-500">NG</span>
        </h1>
        <p className="text-zinc-400 mb-8">Every gist, every day.</p>

        <div className="flex flex-col gap-3 w-64 mx-auto">
          <Link
            href="/login"
            className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg text-sm font-semibold transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="border border-zinc-700 text-white p-3 rounded-lg text-sm font-semibold hover:bg-zinc-900 transition-colors"
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}