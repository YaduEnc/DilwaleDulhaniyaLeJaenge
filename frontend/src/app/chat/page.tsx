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
    const [commonInterests, setCommonInterests] = useState<string[]>([]);
    const [messages, setMessages] = useState<{ sender: string, text: string }[]>([]);
    const [inputText, setInputText] = useState("");
    const [connectionState, setConnectionState] = useState<string>('new');
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const hasRequestedMatchRef = useRef(false);
    const isInitiatorRef = useRef(false);

    // Set local video stream
    useEffect(() => {
        if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    // Set remote video stream
    useEffect(() => {
        if (remoteStream && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    const cleanup = useCallback(() => {
        console.log('Cleaning up WebRTC...');
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }
        setRemoteStream(null);
        setConnectionState('new');
    }, [localStream]);

    const startLocalStream = useCallback(async () => {
        try {
            console.log('Requesting camera/mic permissions...');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            console.log('Got local stream!');
            setLocalStream(stream);
            return stream;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            alert('Could not access camera/microphone. Please allow permissions and try again.');
            return null;
        }
    }, []);

    const createPeerConnection = useCallback((stream: MediaStream) => {
        if (!socket) return null;

        console.log('Creating peer connection...');
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate');
                socket.emit('ice-candidate', { candidate: event.candidate.toJSON() });
            }
        };

        pc.ontrack = (event) => {
            console.log('Received remote track!');
            setRemoteStream(event.streams[0]);
        };

        pc.onconnectionstatechange = () => {
            console.log('Connection state:', pc.connectionState);
            setConnectionState(pc.connectionState);
        };

        // Add local tracks to the connection
        stream.getTracks().forEach(track => {
            console.log('Adding track:', track.kind);
            pc.addTrack(track, stream);
        });

        peerConnectionRef.current = pc;
        return pc;
    }, [socket]);

    const initiateCall = useCallback(async (stream: MediaStream) => {
        if (!socket) return;

        const pc = createPeerConnection(stream);
        if (!pc) return;

        console.log('Creating offer...');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        console.log('Sending offer');
        socket.emit('offer', { offer: pc.localDescription });
    }, [socket, createPeerConnection]);

    const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit, stream: MediaStream) => {
        if (!socket) return;

        const pc = createPeerConnection(stream);
        if (!pc) return;

        console.log('Received offer, setting remote description...');
        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        console.log('Creating answer...');
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        console.log('Sending answer');
        socket.emit('answer', { answer: pc.localDescription });
    }, [socket, createPeerConnection]);

    const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
        const pc = peerConnectionRef.current;
        if (pc) {
            console.log('Received answer, setting remote description...');
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
    }, []);

    const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
        const pc = peerConnectionRef.current;
        if (pc && pc.remoteDescription) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        }
    }, []);

    // Main matchmaking effect - only runs once per connection
    useEffect(() => {
        if (!loading && !user) {
            router.push('/');
            return;
        }

        if (connected && socket && !hasRequestedMatchRef.current) {
            hasRequestedMatchRef.current = true;

            const savedInterests = localStorage.getItem('userInterests');
            const interests = savedInterests ? JSON.parse(savedInterests) : [];

            console.log('Emitting find_match with interests:', interests);
            socket.emit('find_match', { interests });
        }
    }, [user, loading, connected, socket, router]);

    // Socket event listeners
    useEffect(() => {
        if (!socket) return;

        const onWaiting = () => {
            console.log('Waiting for match...');
            setMatchStatus('searching');
        };

        const onMatchFound = async (data: { roomId: string, peerUid: string, commonInterests: string[], isInitiator: boolean }) => {
            console.log('Match found!', data);
            setRoom(data.roomId);
            setCommonInterests(data.commonInterests);
            setMatchStatus('connected');
            isInitiatorRef.current = data.isInitiator;
            setMessages([{ sender: 'system', text: 'You are now connected to a stranger.' }]);

            // Start getting local stream
            const stream = await startLocalStream();
            if (!stream) return;

            // If we're the initiator, start the call after a short delay
            if (data.isInitiator) {
                setTimeout(() => {
                    initiateCall(stream);
                }, 1000);
            }
        };

        const onOffer = async (data: { offer: RTCSessionDescriptionInit }) => {
            console.log('Received offer');
            // Make sure we have local stream first
            let stream = localStream;
            if (!stream) {
                stream = await startLocalStream();
            }
            if (stream) {
                handleOffer(data.offer, stream);
            }
        };

        const onAnswer = (data: { answer: RTCSessionDescriptionInit }) => {
            handleAnswer(data.answer);
        };

        const onIceCandidate = (data: { candidate: RTCIceCandidateInit }) => {
            handleIceCandidate(data.candidate);
        };

        const onPeerDisconnected = () => {
            setMatchStatus('disconnected');
            cleanup();
            setMessages(prev => [...prev, { sender: 'system', text: 'Stranger has disconnected.' }]);
        };

        const onReceiveMessage = (data: { text: string }) => {
            setMessages(prev => [...prev, { sender: 'stranger', text: data.text }]);
        };

        socket.on('waiting', onWaiting);
        socket.on('match_found', onMatchFound);
        socket.on('offer', onOffer);
        socket.on('answer', onAnswer);
        socket.on('ice-candidate', onIceCandidate);
        socket.on('peer_disconnected', onPeerDisconnected);
        socket.on('receive_message', onReceiveMessage);

        return () => {
            socket.off('waiting', onWaiting);
            socket.off('match_found', onMatchFound);
            socket.off('offer', onOffer);
            socket.off('answer', onAnswer);
            socket.off('ice-candidate', onIceCandidate);
            socket.off('peer_disconnected', onPeerDisconnected);
            socket.off('receive_message', onReceiveMessage);
        };
    }, [socket, startLocalStream, initiateCall, handleOffer, handleAnswer, handleIceCandidate, cleanup, localStream]);

    const handleSkip = () => {
        if (socket) {
            cleanup();
            socket.emit('skip');
            setMatchStatus('searching');
            setRoom(null);
            setMessages([]);
            hasRequestedMatchRef.current = false;

            const savedInterests = localStorage.getItem('userInterests');
            const interests = savedInterests ? JSON.parse(savedInterests) : [];

            setTimeout(() => {
                hasRequestedMatchRef.current = true;
                socket.emit('find_match', { interests });
            }, 100);
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

    if (loading || !user) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white text-black font-mono">
                <p className="text-sm">LOADING...</p>
            </div>
        );
    }

    return (
        <main className="flex flex-col h-screen bg-white text-black font-mono">
            {/* Header */}
            <header className="border-b-2 border-black p-4 flex justify-between items-center shrink-0">
                <div className="flex flex-col">
                    <h1 className="text-xl font-bold tracking-tighter uppercase">Dilwale Chat</h1>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                        {matchStatus === 'searching' ? 'Searching for stranger...' :
                            matchStatus === 'disconnected' ? 'Stranger disconnected' :
                                `Connected • ${connectionState}`}
                    </p>
                </div>
                <button
                    onClick={handleSkip}
                    className="bg-black text-white px-6 py-2 text-sm font-bold hover:bg-white hover:text-black border border-black transition-all uppercase"
                >
                    {matchStatus === 'searching' ? 'Stop' : 'Next (Esc)'}
                </button>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Video Area */}
                <div className="flex-1 bg-gray-50 border-r-2 border-black flex flex-col relative">
                    <div className="flex-1 flex items-center justify-center p-4">
                        {matchStatus === 'searching' ? (
                            <div className="text-center">
                                <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-sm uppercase tracking-widest">Finding someone...</p>
                            </div>
                        ) : (
                            <div className="w-full h-full grid grid-rows-2 gap-2">
                                {/* Remote Video (Stranger) */}
                                <div className="bg-black relative overflow-hidden">
                                    <video
                                        ref={remoteVideoRef}
                                        autoPlay
                                        playsInline
                                        className="w-full h-full object-cover"
                                    />
                                    {!remoteStream && (
                                        <div className="absolute inset-0 flex items-center justify-center text-white text-xs uppercase">
                                            {matchStatus === 'disconnected' ? 'Disconnected' : 'Connecting video...'}
                                        </div>
                                    )}
                                    <span className="absolute bottom-2 left-2 text-[10px] bg-black/70 text-white px-2 py-0.5 uppercase">Stranger</span>
                                </div>

                                {/* Local Video (You) */}
                                <div className="bg-gray-900 relative overflow-hidden">
                                    <video
                                        ref={localVideoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover transform scale-x-[-1]"
                                    />
                                    {!localStream && (
                                        <div className="absolute inset-0 flex items-center justify-center text-white text-xs uppercase">
                                            Waiting for camera...
                                        </div>
                                    )}
                                    <span className="absolute bottom-2 left-2 text-[10px] bg-black/70 text-white px-2 py-0.5 uppercase">You</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {commonInterests.length > 0 && matchStatus === 'connected' && (
                        <div className="absolute bottom-4 left-4 right-4 bg-white/90 border border-black p-2">
                            <p className="text-[10px] uppercase text-gray-400 mb-1">Common Interests:</p>
                            <div className="flex flex-wrap gap-1">
                                {commonInterests.map(i => (
                                    <span key={i} className="text-[10px] bg-black text-white px-2 py-0.5 uppercase">{i}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Chat Area */}
                <div className="w-80 flex flex-col shrink-0 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
                                {msg.sender === 'system' ? (
                                    <p className="text-[10px] text-gray-400 uppercase text-center w-full my-2">{msg.text}</p>
                                ) : (
                                    <>
                                        <span className="text-[8px] uppercase text-gray-400 mb-0.5">{msg.sender === 'me' ? 'You' : 'Stranger'}</span>
                                        <div className={`p-2 text-xs max-w-[90%] border ${msg.sender === 'me' ? 'bg-black text-white border-black' : 'bg-white text-black border-black'}`}>
                                            {msg.text}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                    <form onSubmit={sendMessage} className="p-4 border-t-2 border-black shrink-0">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="TYPE A MESSAGE..."
                            className="w-full border-2 border-black p-2 text-sm focus:outline-none focus:bg-gray-50 uppercase"
                            disabled={matchStatus !== 'connected'}
                        />
                    </form>
                </div>
            </div>
        </main>
    );
}
