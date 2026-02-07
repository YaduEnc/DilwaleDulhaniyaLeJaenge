import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function HomePage() {
    const { user, loading, loginWithGoogle } = useAuth();
    const navigate = useNavigate();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white text-black font-mono">
                <p className="animate-pulse text-sm">INITIALIZING...</p>
            </div>
        );
    }

    return (
        <main className="relative flex flex-col items-center justify-center min-h-screen bg-white text-black overflow-hidden">
            {/* Background Decorative Element */}
            <div className="absolute top-0 left-0 w-full h-1 bg-black overflow-hidden">
                <div className="animate-marquee flex">
                    {[...Array(10)].map((_, i) => (
                        <span key={i} className="px-8 py-1 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                            LIVE CONNECTION ESTABLISHED • STATUS: ACTIVE • NOISE REDUCTION: ON •
                        </span>
                    ))}
                </div>
            </div>

            <div className="relative z-10 max-w-2xl w-full px-6 flex flex-col items-center">
                <div className="w-full border-[4px] border-black p-10 md:p-16 bg-white brutalist-shadow transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                    <h1 className="text-7xl md:text-9xl font-black mb-0 tracking-tighter leading-none italic uppercase">
                        DIL<span className="text-[#E11D48] crimson-glow">WALE</span>
                    </h1>
                    <p className="text-xs mt-4 mb-10 uppercase tracking-[0.5em] text-gray-400 font-bold border-b-2 border-black pb-4">
                        Visual Connection Engine V1.0
                    </p>

                    {user ? (
                        <div className="flex flex-col gap-6">
                            <div className="flex items-center justify-between border-b border-black pb-2 group">
                                <span className="text-[10px] uppercase font-bold text-gray-400">Operator</span>
                                <span className="text-sm font-bold truncate ml-4 group-hover:text-[#E11D48] transition-colors uppercase italic">{user.email}</span>
                            </div>
                            <button
                                onClick={() => navigate('/interests')}
                                className="group relative w-full bg-black text-white p-5 text-lg font-black hover:bg-[#E11D48] transition-all uppercase flex items-center justify-center gap-2 overflow-hidden"
                            >
                                <span className="relative z-10">Start Matching</span>
                                <svg className="w-6 h-6 transform group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-8">
                            <p className="text-lg md:text-xl leading-snug font-medium italic">
                                Face-to-face with the world. No fluff.
                                Just raw, real-time human interaction.
                            </p>
                            <button
                                onClick={loginWithGoogle}
                                className="group w-full bg-black text-white p-5 text-lg font-black hover:bg-white hover:text-black border-4 border-black transition-all uppercase flex items-center justify-center gap-4"
                            >
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6 bg-white p-1 rounded-sm" alt="G" />
                                Connect with Google
                            </button>
                        </div>
                    )}
                </div>

                <div className="mt-12 flex gap-8">
                    <div className="flex flex-col items-center">
                        <span className="text-3xl font-black">2.4k+</span>
                        <span className="text-[10px] uppercase font-bold text-gray-400">Active</span>
                    </div>
                    <div className="w-[1px] bg-gray-200" />
                    <div className="flex flex-col items-center">
                        <span className="text-3xl font-black">99.9%</span>
                        <span className="text-[10px] uppercase font-bold text-gray-400">Uptime</span>
                    </div>
                    <div className="w-[1px] bg-gray-200" />
                    <div className="flex flex-col items-center">
                        <span className="text-3xl font-black">SECURE</span>
                        <span className="text-[10px] uppercase font-bold text-gray-400">Encrypted</span>
                    </div>
                </div>
            </div>

            <footer className="absolute bottom-8 text-[12px] font-bold uppercase tracking-[0.3em] text-gray-300">
                Designed for visual intensity &copy; 2025 Dilwale
            </footer>

            {/* Aesthetic Accents */}
            <div className="absolute bottom-0 right-0 p-8 flex flex-col items-end opacity-20 pointer-events-none">
                <div className="text-9xl font-black leading-none">V1</div>
                <div className="text-xl font-bold uppercase">Production Build</div>
            </div>
        </main>
    );
}
