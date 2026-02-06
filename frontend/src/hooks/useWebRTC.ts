'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

interface UseWebRTCProps {
    socket: Socket | null;
    isInitiator: boolean;
    onRemoteStream: (stream: MediaStream) => void;
    onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
}

export const useWebRTC = ({ socket, isInitiator, onRemoteStream, onConnectionStateChange }: UseWebRTCProps) => {
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    const createPeerConnection = useCallback(() => {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                socket.emit('ice-candidate', { candidate: event.candidate.toJSON() });
            }
        };

        pc.ontrack = (event) => {
            console.log('Received remote track');
            onRemoteStream(event.streams[0]);
        };

        pc.onconnectionstatechange = () => {
            console.log('Connection state:', pc.connectionState);
            onConnectionStateChange?.(pc.connectionState);
        };

        peerConnectionRef.current = pc;
        return pc;
    }, [socket, onRemoteStream, onConnectionStateChange]);

    const startLocalStream = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            localStreamRef.current = stream;
            return stream;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            return null;
        }
    }, []);

    const initiateCall = useCallback(async () => {
        if (!socket) return;

        const stream = await startLocalStream();
        if (!stream) return;

        const pc = createPeerConnection();

        stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        console.log('Sending offer');
        socket.emit('offer', { offer: pc.localDescription });
    }, [socket, startLocalStream, createPeerConnection]);

    const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit) => {
        if (!socket) return;

        const stream = await startLocalStream();
        if (!stream) return;

        const pc = createPeerConnection();

        stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
        });

        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        console.log('Sending answer');
        socket.emit('answer', { answer: pc.localDescription });
    }, [socket, startLocalStream, createPeerConnection]);

    const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
        const pc = peerConnectionRef.current;
        if (pc) {
            console.log('Received answer');
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
    }, []);

    const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
        const pc = peerConnectionRef.current;
        if (pc) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        }
    }, []);

    const cleanup = useCallback(() => {
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!socket) return;

        socket.on('offer', (data: { offer: RTCSessionDescriptionInit }) => {
            handleOffer(data.offer);
        });

        socket.on('answer', (data: { answer: RTCSessionDescriptionInit }) => {
            handleAnswer(data.answer);
        });

        socket.on('ice-candidate', (data: { candidate: RTCIceCandidateInit }) => {
            handleIceCandidate(data.candidate);
        });

        return () => {
            socket.off('offer');
            socket.off('answer');
            socket.off('ice-candidate');
            cleanup();
        };
    }, [socket, handleOffer, handleAnswer, handleIceCandidate, cleanup]);

    useEffect(() => {
        if (isInitiator && socket) {
            // Small delay to ensure both peers are ready
            const timeout = setTimeout(() => {
                initiateCall();
            }, 500);
            return () => clearTimeout(timeout);
        }
    }, [isInitiator, socket, initiateCall]);

    return {
        localStream: localStreamRef.current,
        cleanup,
        startLocalStream,
    };
};
