const floatingBubbles = [
  { text: "How far 👋", top: "12%", left: "8%", delay: "0s" },
  { text: "On my way!", top: "22%", left: "72%", delay: "1.2s" },
  { text: "Lmaooo 😂", top: "68%", left: "12%", delay: "2.1s" },
  { text: "Call me later ❤️", top: "78%", left: "66%", delay: "0.6s" },
  { text: "Omo see this", top: "45%", left: "85%", delay: "1.8s" },
];

export default function ChatBackground() {
  return (
    <>
      <div className="pointer-events-none fixed -top-32 -left-24 h-72 w-72 rounded-full bg-blue-500/20 blur-[100px]" />
      <div className="pointer-events-none fixed -bottom-32 -right-24 h-72 w-72 rounded-full bg-amber-400/10 blur-[100px]" />

      {floatingBubbles.map((b, i) => (
        <div
          key={i}
          className="pointer-events-none fixed rounded-2xl rounded-bl-sm bg-white/5 px-3 py-1.5 text-xs text-zinc-300 border border-white/10 backdrop-blur-sm animate-[float_6s_ease-in-out_infinite]"
          style={{ top: b.top, left: b.left, animationDelay: b.delay }}
        >
          {b.text}
        </div>
      ))}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); opacity: 0.7; }
          50% { transform: translateY(-14px); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-\\[float_6s_ease-in-out_infinite\\] { animation: none; }
        }
      `}</style>
    </>
  );
}