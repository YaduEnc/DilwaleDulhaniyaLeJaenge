'use client';

import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user, loading, loginWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      // Logic for automatic redirection if needed
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white text-black font-mono">
        <p className="text-sm">LOADING...</p>
      </div>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-white text-black px-6 font-mono">
      <div className="max-w-md w-full border-2 border-black p-8">
        <h1 className="text-4xl font-bold mb-2 tracking-tighter">DILWALE</h1>
        <p className="text-xs mb-8 border-b border-black pb-4 uppercase tracking-widest text-gray-500">
          Random Video Chat MVP
        </p>

        {user ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-black pb-2">
              <span className="text-xs uppercase">Identity</span>
              <span className="text-sm truncate ml-4 text-right">{user.email}</span>
            </div>
            <button
              onClick={() => router.push('/interests')}
              className="w-full bg-black text-white p-3 text-sm font-bold hover:bg-white hover:text-black border border-black transition-all uppercase"
            >
              Start Chatting
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <p className="text-sm leading-relaxed">
              Connect with strangers instantly.
              No noise. No flashy visuals. Just human connection.
            </p>
            <button
              onClick={loginWithGoogle}
              className="w-full bg-black text-white p-3 text-sm font-bold hover:bg-white hover:text-black border border-black transition-all uppercase"
            >
              Sign in with Google
            </button>
          </div>
        )}
      </div>

      <footer className="mt-12 text-[10px] text-gray-300 uppercase tracking-widest">
        &copy; 2025 Dilwale Project
      </footer>
    </main>
  );
}
