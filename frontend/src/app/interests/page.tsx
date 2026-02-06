'use client';

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const POPULAR_INTERESTS = [
    "Music", "Coding", "Movies", "Anime", "Gaming",
    "Politics", "Art", "Travel", "Tech", "Fitness"
];

export default function InterestsPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
    const [customInterest, setCustomInterest] = useState("");

    useEffect(() => {
        if (!loading && !user) {
            router.push('/');
        }
    }, [user, loading, router]);

    const toggleInterest = (interest: string) => {
        if (selectedInterests.includes(interest)) {
            setSelectedInterests(selectedInterests.filter(i => i !== interest));
        } else {
            setSelectedInterests([...selectedInterests, interest]);
        }
    };

    const addCustomInterest = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = customInterest.trim();
        if (trimmed && !selectedInterests.includes(trimmed)) {
            setSelectedInterests([...selectedInterests, trimmed]);
            setCustomInterest("");
        }
    };

    const handleStartMatching = () => {
        // Save selected interests to local storage or state for the chat screen
        if (typeof window !== 'undefined') {
            localStorage.setItem('userInterests', JSON.stringify(selectedInterests));
        }
        router.push('/chat');
    };

    if (loading || !user) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white text-black font-mono">
                <p className="text-sm">LOADING...</p>
            </div>
        );
    }

    return (
        <main className="flex flex-col items-center justify-center min-h-screen bg-white text-black px-6 font-mono">
            <div className="max-w-xl w-full border-2 border-black p-8">
                <h1 className="text-3xl font-bold mb-1 tracking-tighter uppercase">Interests</h1>
                <p className="text-[10px] mb-8 border-b border-black pb-4 uppercase tracking-widest text-gray-500">
                    Select what you want to talk about
                </p>

                <form onSubmit={addCustomInterest} className="mb-8 flex gap-2">
                    <input
                        type="text"
                        value={customInterest}
                        onChange={(e) => setCustomInterest(e.target.value)}
                        placeholder="ADD CUSTOM INTEREST..."
                        className="flex-1 border-2 border-black p-2 text-sm focus:outline-none focus:bg-gray-50 uppercase"
                    />
                    <button
                        type="submit"
                        className="border-2 border-black bg-black text-white px-4 py-2 text-sm font-bold hover:bg-white hover:text-black transition-all"
                    >
                        ADD
                    </button>
                </form>

                <div className="flex flex-wrap gap-2 mb-10">
                    {POPULAR_INTERESTS.map(interest => (
                        <button
                            key={interest}
                            onClick={() => toggleInterest(interest)}
                            className={`border border-black px-3 py-1 text-xs uppercase transition-all ${selectedInterests.includes(interest)
                                    ? 'bg-black text-white'
                                    : 'bg-white text-black hover:bg-gray-100'
                                }`}
                        >
                            {interest}
                        </button>
                    ))}
                    {selectedInterests.filter(i => !POPULAR_INTERESTS.includes(i)).map(interest => (
                        <button
                            key={interest}
                            onClick={() => toggleInterest(interest)}
                            className="border border-black px-3 py-1 text-xs uppercase bg-black text-white"
                        >
                            {interest} [X]
                        </button>
                    ))}
                </div>

                <button
                    onClick={handleStartMatching}
                    disabled={selectedInterests.length === 0}
                    className={`w-full p-4 text-sm font-bold border-2 border-black transition-all uppercase ${selectedInterests.length > 0
                            ? 'bg-black text-white hover:bg-white hover:text-black'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                >
                    {selectedInterests.length > 0
                        ? `Start Matching (${selectedInterests.length})`
                        : 'Select at least one interest'}
                </button>

                <p className="mt-4 text-[10px] text-center text-gray-400 uppercase">
                    Matching prioritized by interests. If no match found, random user will be selected.
                </p>
            </div>

            <button
                onClick={() => router.push('/')}
                className="mt-8 text-[10px] uppercase border-b border-black hover:text-gray-500"
            >
                BACK TO START
            </button>
        </main>
    );
}
