'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
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
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);

    const cleanup = useCallback(() => {
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }
    }, [localStream]);

    const startLocalStream = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            setLocalStream(stream);
            return stream;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            return null;
        }
    }, []);

    const createPeerConnection = useCallback((stream: MediaStream) => {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                socket.emit('ice-candidate', { candidate: event.candidate.toJSON() });
            }
        };

        pc.ontrack = (event) => {
            onRemoteStream(event.streams[0]);
        };

        pc.onconnectionstatechange = () => {
            onConnectionStateChange?.(pc.connectionState);
        };

        stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
        });

        peerConnectionRef.current = pc;
        return pc;
    }, [socket, onRemoteStream, onConnectionStateChange]);

    const initiateCall = useCallback(async () => {
        if (!socket) return;
        const stream = await startLocalStream();
        if (!stream) return;

        const pc = createPeerConnection(stream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { offer: pc.localDescription });
    }, [socket, startLocalStream, createPeerConnection]);

    const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit) => {
        if (!socket) return;
        const stream = await startLocalStream();
        if (!stream) return;

        const pc = createPeerConnection(stream);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { answer: pc.localDescription });
    }, [socket, startLocalStream, createPeerConnection]);

    const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
        if (peerConnectionRef.current) {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        }
    }, []);

    const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
        if (peerConnectionRef.current) {
            try {
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                console.error('Error adding ice candidate', e);
            }
        }
    }, []);

    useEffect(() => {
        if (!socket) return;

        socket.on('offer', (data: { offer: RTCSessionDescriptionInit }) => handleOffer(data.offer));
        socket.on('answer', (data: { answer: RTCSessionDescriptionInit }) => handleAnswer(data.answer));
        socket.on('ice-candidate', (data: { candidate: RTCIceCandidateInit }) => handleIceCandidate(data.candidate));

        return () => {
            socket.off('offer');
            socket.off('answer');
            socket.off('ice-candidate');
            cleanup();
        };
    }, [socket, handleOffer, handleAnswer, handleIceCandidate, cleanup]);

    useEffect(() => {
        if (isInitiator && socket) {
            initiateCall();
        }
    }, [isInitiator, socket, initiateCall]);

    return { localStream, cleanup, startLocalStream };
};
