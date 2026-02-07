'use client';

import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

export default function ChatPage() {
    const { user, loading } = useAuth();
    const { socket, connected } = useSocket();
    const router = useRouter();

    const [matchStatus, setMatchStatus] = useState<'searching' | 'connected' | 'disconnected'>('searching');
    const [room, setRoom] = useState<string | null>(null);
    const [messages, setMessages] = useState<{ sender: string, text: string }[]>([]);
    const [inputText, setInputText] = useState("");
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);

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
            router.push('/');
            return;
        }

        if (connected && socket && !hasRequestedMatchRef.current) {
            hasRequestedMatchRef.current = true;
            const savedInterests = localStorage.getItem('userInterests');
            const interests = savedInterests ? JSON.parse(savedInterests) : [];
            socket.emit('find_match', { interests });
        }
    }, [user, loading, connected, socket, router]);

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
            // Immediate re-search
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
        <main className="flex flex-col h-screen bg-white text-black font-mono overflow-hidden">
            <header className="border-b-2 border-black p-4 flex justify-between items-center bg-white z-10">
                <h1 className="text-xl font-bold tracking-tighter uppercase">Dilwale Chat</h1>
                <div className="flex gap-4">
                    <span className="text-xs self-center uppercase text-gray-400">
                        {matchStatus === 'searching' ? 'Searching...' : 'Engaged'}
                    </span>
                    <button onClick={handleSkip} className="bg-black text-white px-6 py-2 text-sm font-bold border border-black uppercase hover:bg-white hover:text-black">
                        Skip
                    </button>
                </div>
            </header>

            <div className="flex-1 flex flex-col md:flex-row min-h-0">
                <div className="flex-1 bg-gray-100 flex flex-col p-4 gap-4 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                        <div className="bg-black relative aspect-video md:aspect-auto">
                            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            <span className="absolute bottom-2 left-2 text-[10px] bg-black/50 text-white px-2 uppercase">Stranger</span>
                        </div>
                        <div className="bg-black relative aspect-video md:aspect-auto">
                            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
                            <span className="absolute bottom-2 left-2 text-[10px] bg-black/50 text-white px-2 uppercase">You</span>
                        </div>
                    </div>
                </div>

                <div className="w-full md:w-80 border-t-2 md:border-t-0 md:border-l-2 border-black flex flex-col bg-white">
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                        {messages.map((ms, i) => (
                            <div key={i} className={`flex flex-col ${ms.sender === 'me' ? 'items-end' : 'items-start'}`}>
                                <span className="text-[8px] uppercase text-gray-400">{ms.sender}</span>
                                <div className={`p-2 text-xs border ${ms.sender === 'me' ? 'bg-black text-white border-black' : 'bg-white text-black border-black'}`}>
                                    {ms.text}
                                </div>
                            </div>
                        ))}
                    </div>
                    <form onSubmit={sendMessage} className="p-4 border-t-2 border-black">
                        <input
                            type="text"
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            placeholder="TYPE MESSAGE..."
                            className="w-full border-2 border-black p-2 text-sm focus:outline-none uppercase"
                            disabled={matchStatus !== 'connected'}
                        />
                    </form>
                </div>
            </div>
        </main>
    );
}
