import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

export default function ChatPage() {
    const { user, loading } = useAuth();
    const { socket, connected } = useSocket();
    const navigate = useNavigate();

    const [matchStatus, setMatchStatus] = useState<'searching' | 'connected' | 'disconnected'>('searching');
    const [room, setRoom] = useState<string | null>(null);
    const [messages, setMessages] = useState<{ sender: string, text: string }[]>([]);
    const [inputText, setInputText] = useState("");
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const hasRequestedMatchRef = useRef(false);

    const cleanup = useCallback(() => {
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }
        setRemoteStream(null);
    }, [localStream]);

    const startLocalStream = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            return stream;
        } catch (error) {
            console.error('Media error:', error);
            return null;
        }
    }, []);

    const createPeerConnection = useCallback((stream: MediaStream) => {
        if (!socket) return null;
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', { candidate: event.candidate.toJSON() });
            }
        };

        pc.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
        };

        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        peerConnectionRef.current = pc;
        return pc;
    }, [socket]);

    useEffect(() => {
        if (localStream && localVideoRef.current) localVideoRef.current.srcObject = localStream;
    }, [localStream]);

    useEffect(() => {
        if (remoteStream && remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
    }, [remoteStream]);

    useEffect(() => {
        if (!loading && !user) {
            navigate('/');
            return;
        }

        if (connected && socket && !hasRequestedMatchRef.current) {
            hasRequestedMatchRef.current = true;
            const savedInterests = localStorage.getItem('userInterests');
            const interests = savedInterests ? JSON.parse(savedInterests) : [];
            socket.emit('find_match', { interests });
        }
    }, [user, loading, connected, socket, navigate]);

    useEffect(() => {
        if (!socket) return;

        socket.on('match_found', async (data: { isInitiator: boolean, roomId: string }) => {
            setMatchStatus('connected');
            setRoom(data.roomId);
            const stream = await startLocalStream();
            if (!stream) return;

            const pc = createPeerConnection(stream);
            if (data.isInitiator && pc) {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('offer', { offer: pc.localDescription });
            }
        });

        socket.on('offer', async (data: { offer: RTCSessionDescriptionInit }) => {
            const stream = localStream || await startLocalStream();
            if (!stream) return;
            const pc = createPeerConnection(stream);
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('answer', { answer: pc.localDescription });
            }
        });

        socket.on('answer', async (data: { answer: RTCSessionDescriptionInit }) => {
            if (peerConnectionRef.current) {
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
            }
        });

        socket.on('ice-candidate', async (data: { candidate: RTCIceCandidateInit }) => {
            if (peerConnectionRef.current) {
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        });

        socket.on('receive_message', (data: { text: string }) => {
            setMessages(prev => [...prev, { sender: 'stranger', text: data.text }]);
        });

        socket.on('peer_disconnected', () => {
            setMatchStatus('disconnected');
            cleanup();
        });

        return () => {
            socket.off('match_found');
            socket.off('offer');
            socket.off('answer');
            socket.off('ice-candidate');
            socket.off('receive_message');
            socket.off('peer_disconnected');
        };
    }, [socket, localStream, startLocalStream, createPeerConnection, cleanup]);

    const handleSkip = () => {
        if (socket) {
            cleanup();
            socket.emit('skip');
            setMatchStatus('searching');
            hasRequestedMatchRef.current = false;
            const savedInterests = localStorage.getItem('userInterests');
            const interests = savedInterests ? JSON.parse(savedInterests) : [];
            socket.emit('find_match', { interests });
            hasRequestedMatchRef.current = true;
        }
    };

    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputText.trim() && socket && room) {
            socket.emit('send_message', { text: inputText });
            setMessages(prev => [...prev, { sender: 'me', text: inputText }]);
            setInputText("");
        }
    };

    if (loading || !user) return null;

    return (
        <main className="flex flex-col h-screen bg-black text-white overflow-hidden">
            {/* Control Header */}
            <header className="absolute top-0 left-0 w-full z-20 flex justify-between items-center p-6 pointer-events-none">
                <div className="bg-black border-2 border-white px-4 py-2 pointer-events-auto brutalist-shadow">
                    <h1 className="text-xl font-black italic tracking-tighter uppercase leading-none">
                        DIL<span className="text-[#E11D48]">WALE</span>
                    </h1>
                </div>

                <div className="flex gap-4 pointer-events-auto">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="bg-black border-2 border-white p-3 hover:bg-white hover:text-black transition-all"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.827-1.213L3 21l1.83-4.351C3.418 15.158 3 13.658 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    </button>
                    <button
                        onClick={handleSkip}
                        className="bg-[#E11D48] border-2 border-white px-8 py-2 text-sm font-black uppercase hover:bg-white hover:text-black transition-all brutalist-shadow"
                    >
                        Next Stranger
                    </button>
                </div>
            </header>

            {/* Video Canvas */}
            <div className="flex-1 relative bg-[#0A0A0A] flex flex-col md:flex-row min-h-0">
                <div className={`flex-1 relative transition-all duration-500 ${isSidebarOpen ? 'md:mr-80' : ''}`}>
                    <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-2 gap-2 p-2 pt-24 pb-8 h-full bg-black">
                        {/* Remote Video Container */}
                        <div className="relative group border-2 border-white/10 overflow-hidden bg-black flex items-center justify-center">
                            {matchStatus === 'searching' ? (
                                <div className="text-center p-8">
                                    <div className="w-16 h-16 border-t-4 border-[#E11D48] rounded-full animate-spin mx-auto mb-6"></div>
                                    <p className="text-2xl font-black italic uppercase tracking-widest animate-pulse font-heading">Hunting for matches...</p>
                                    <p className="text-[10px] mt-2 uppercase text-gray-500 font-bold opacity-0 md:opacity-100 italic">Scanning server clusters for available peers</p>
                                </div>
                            ) : (
                                <>
                                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                    <div className="absolute top-4 left-4 bg-black/80 border-2 border-[#E11D48] px-3 py-1 text-[10px] font-black uppercase tracking-widest italic">Live Feed: Stranger</div>
                                </>
                            )}
                        </div>

                        {/* Local Video Container */}
                        <div className="relative group border-2 border-white/10 overflow-hidden bg-black flex items-center justify-center lg:aspect-video aspect-video md:aspect-auto">
                            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
                            <div className="absolute top-4 left-4 bg-black/80 border-2 border-white px-3 py-1 text-[10px] font-black uppercase tracking-widest italic">Local Feed: You</div>
                            {/* Overlay Controls for Local Stream */}
                            <div className="absolute bottom-4 right-4 flex gap-2">
                                <div className="w-3 h-3 bg-[#E11D48] rounded-full animate-ping" />
                                <span className="text-[8px] font-bold uppercase text-white/50">TRANS-LINK ACTIVE</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Chat */}
                <aside className={`absolute md:relative top-0 right-0 h-full w-full md:w-80 bg-black border-l-4 border-white z-30 transition-transform duration-500 transform ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="flex flex-col h-full">
                        <div className="p-6 border-b-2 border-white flex justify-between items-center">
                            <h2 className="text-xl font-black italic uppercase italic">Operator Chat</h2>
                            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-white">✕</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {messages.length === 0 && (
                                <div className="text-center py-20 opacity-20">
                                    <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                    </svg>
                                    <p className="text-[10px] uppercase font-bold">No data exchange detected</p>
                                </div>
                            )}
                            {messages.map((ms, i) => (
                                <div key={i} className={`flex flex-col ${ms.sender === 'me' ? 'items-end' : 'items-start'}`}>
                                    <span className={`text-[8px] font-black uppercase mb-1 ${ms.sender === 'me' ? 'text-gray-500' : 'text-[#E11D48]'}`}>
                                        {ms.sender === 'me' ? 'Local_Protocol' : 'Remote_Identity'}
                                    </span>
                                    <div className={`max-w-[85%] p-4 text-sm font-bold border-2 ${ms.sender === 'me'
                                            ? 'bg-white text-black border-white'
                                            : 'bg-black text-white border-[#E11D48]'
                                        }`}>
                                        {ms.text}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <form onSubmit={sendMessage} className="p-6 bg-black border-t-4 border-white">
                            <input
                                type="text"
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                placeholder="ENTER MESSAGE..."
                                className="w-full bg-black border-2 border-white p-4 text-sm font-bold focus:outline-none focus:border-[#E11D48] uppercase placeholder:text-gray-600"
                                disabled={matchStatus !== 'connected'}
                            />
                        </form>
                    </div>
                </aside>
            </div>

            {/* Connection Info Bar */}
            <div className={`absolute bottom-0 left-0 w-full h-8 bg-[#E11D48] z-40 flex items-center px-6 transition-transform duration-500 ${isSidebarOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}`}>
                <div className="flex justify-between w-full text-[10px] font-black uppercase tracking-tighter text-white">
                    <div className="flex gap-4">
                        <span>P2P_TUNNEL: {connected ? 'SECURE' : 'ESTABLISHING...'}</span>
                        <span className="opacity-50">•</span>
                        <span>LATENCY: 42MS</span>
                    </div>
                    <div className="flex gap-4">
                        <span className="animate-pulse">● LIVE_NODE_NYC_04</span>
                    </div>
                </div>
            </div>
        </main>
    );
}
