import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const POPULAR_INTERESTS = [
    "Cinema", "Engineering", "Travel", "Philosophy", "Gaming",
    "Underground", "Visual Arts", "Strategy", "Tech", "Fitness"
];

export default function InterestsPage() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
    const [customInterest, setCustomInterest] = useState("");

    useEffect(() => {
        if (!loading && !user) {
            navigate('/');
        }
    }, [user, loading, navigate]);

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
        localStorage.setItem('userInterests', JSON.stringify(selectedInterests));
        navigate('/chat');
    };

    if (loading || !user) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white text-black font-mono">
                <p className="animate-pulse text-sm">LOADING COMPONENT...</p>
            </div>
        );
    }

    return (
        <main className="flex flex-col items-center justify-center min-h-screen bg-[#FDFDFD] text-black px-6">
            <div className="max-w-3xl w-full border-[3px] border-black bg-white p-10 md:p-14 brutalist-shadow">
                <div className="flex justify-between items-start mb-10 border-b-2 border-black pb-6">
                    <div>
                        <h1 className="text-5xl font-black italic uppercase italic tracking-tighter">Interests</h1>
                        <p className="text-[10px] uppercase font-black text-gray-400 tracking-[0.4em]">Filter your connections</p>
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        className="text-[10px] font-black uppercase border-2 border-black px-3 py-1 hover:bg-black hover:text-white transition-all"
                    >
                        CANCEL
                    </button>
                </div>

                <form onSubmit={addCustomInterest} className="mb-12">
                    <label className="block text-[10px] uppercase font-black mb-2">Target Variable (Custom):</label>
                    <div className="flex gap-4">
                        <input
                            type="text"
                            value={customInterest}
                            onChange={(e) => setCustomInterest(e.target.value)}
                            placeholder="Type an interest..."
                            className="flex-1 border-b-4 border-black p-4 text-xl font-bold focus:outline-none focus:bg-gray-50 uppercase placeholder:text-gray-200"
                        />
                        <button
                            type="submit"
                            className="bg-black text-white px-8 py-2 text-sm font-black hover:bg-[#E11D48] transition-all uppercase"
                        >
                            ADD
                        </button>
                    </div>
                </form>

                <div className="mb-14">
                    <label className="block text-[10px] uppercase font-black mb-4 text-gray-400">Primary Categories:</label>
                    <div className="flex flex-wrap gap-3">
                        {POPULAR_INTERESTS.map(interest => (
                            <button
                                key={interest}
                                onClick={() => toggleInterest(interest)}
                                className={`border-2 border-black px-5 py-2 text-sm font-black uppercase transition-all flex items-center gap-2 ${selectedInterests.includes(interest)
                                    ? 'bg-black text-white translate-x-1 translate-y-1 shadow-none'
                                    : 'bg-white text-black hover:bg-gray-100'
                                    }`}
                            >
                                {interest}
                                {selectedInterests.includes(interest) && <span className="text-[#E11D48]">●</span>}
                            </button>
                        ))}
                        {selectedInterests.filter(i => !POPULAR_INTERESTS.includes(i)).map(interest => (
                            <button
                                key={interest}
                                onClick={() => toggleInterest(interest)}
                                className="border-2 border-black px-5 py-2 text-sm font-black uppercase bg-black text-white flex items-center gap-2"
                            >
                                {interest} <span className="text-[#E11D48]">×</span>
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    onClick={handleStartMatching}
                    disabled={selectedInterests.length === 0}
                    className={`w-full p-6 text-xl font-black border-4 border-black transition-all uppercase flex justify-between items-center ${selectedInterests.length > 0
                        ? 'bg-black text-white hover:bg-[#E11D48] hover:border-[#E11D48]'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                        }`}
                >
                    <span>{selectedInterests.length > 0 ? "Enter Matchmaking" : "Select Topic"}</span>
                    {selectedInterests.length > 0 && <span className="bg-[#E11D48] px-3 py-1 text-xs">READY ({selectedInterests.length})</span>}
                </button>
            </div>

            <p className="mt-10 text-[10px] font-black uppercase tracking-widest text-gray-300">
                Awaiting Operator Approval...
            </p>
        </main>
    );
}
