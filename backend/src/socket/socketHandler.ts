import { Server, Socket } from 'socket.io';
import { matchmakingManager } from '../matchmaking/matchmakingManager.js';

export const initializeSocketHandlers = (io: Server) => {
    io.on('connection', (socket: Socket) => {
        console.log(`New client connected: ${socket.id} (${(socket as any).user.email})`);

        socket.on('find_match', (data: { interests: string[] }) => {
            console.log(`User ${socket.id} searching for match with interests:`, data.interests);
            matchmakingManager.addUser(socket, data.interests);
        });

        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id}`);
            const peerId = matchmakingManager.getPeerId(socket.id);
            if (peerId) {
                io.to(peerId).emit('peer_disconnected');
            }
            matchmakingManager.removeUser(socket.id);
        });

        socket.on('skip', () => {
            const peerId = matchmakingManager.getPeerId(socket.id);
            if (peerId) {
                io.to(peerId).emit('peer_disconnected');
            }
            matchmakingManager.removeUser(socket.id);
        });

        // WebRTC Signaling Events
        socket.on('offer', (data: { offer: RTCSessionDescriptionInit }) => {
            const peerId = matchmakingManager.getPeerId(socket.id);
            if (peerId) {
                console.log(`Relaying offer from ${socket.id} to ${peerId}`);
                io.to(peerId).emit('offer', { offer: data.offer });
            }
        });

        socket.on('answer', (data: { answer: RTCSessionDescriptionInit }) => {
            const peerId = matchmakingManager.getPeerId(socket.id);
            if (peerId) {
                console.log(`Relaying answer from ${socket.id} to ${peerId}`);
                io.to(peerId).emit('answer', { answer: data.answer });
            }
        });

        socket.on('ice-candidate', (data: { candidate: RTCIceCandidateInit }) => {
            const peerId = matchmakingManager.getPeerId(socket.id);
            if (peerId) {
                io.to(peerId).emit('ice-candidate', { candidate: data.candidate });
            }
        });

        // Text Chat
        socket.on('send_message', (data: { text: string }) => {
            const peerId = matchmakingManager.getPeerId(socket.id);
            if (peerId) {
                io.to(peerId).emit('receive_message', { text: data.text });
            }
        });

        // Error handling
        socket.on('error', (err) => {
            console.error(`Socket error for ${socket.id}:`, err);
        });
    });
};
