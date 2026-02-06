import { Socket } from 'socket.io';

interface WaitingUser {
    socket: Socket;
    uid: string;
    interests: string[];
    joinedAt: number;
}

class MatchmakingManager {
    private queue: WaitingUser[] = [];
    private activeMatches: Map<string, string> = new Map(); // socketId -> peerSocketId

    public addUser(socket: Socket, interests: string[]) {
        const uid = (socket as any).user.uid;

        // Check if already in queue
        if (this.queue.some(u => u.socket.id === socket.id)) return;

        const newUser: WaitingUser = {
            socket,
            uid,
            interests,
            joinedAt: Date.now()
        };

        this.tryMatch(newUser);
    }

    private tryMatch(user: WaitingUser) {
        // 1. Try interest-based match
        const match = this.queue.find(potentialMatch => {
            if (potentialMatch.uid === user.uid) return false;
            return potentialMatch.interests.some(interest => user.interests.includes(interest));
        });

        if (match) {
            this.pairUsers(user, match);
            return;
        }

        // 2. Fallback: If queue has anyone else, match randomly (for MVP simplicity)
        const randomMatch = this.queue.find(potentialMatch => potentialMatch.uid !== user.uid);
        if (randomMatch) {
            this.pairUsers(user, randomMatch);
            return;
        }

        // 3. No match found, stay in queue
        this.queue.push(user);
        user.socket.emit('waiting', { message: 'Searching for someone to talk to...' });
    }

    private pairUsers(user1: WaitingUser, user2: WaitingUser) {
        // Remove from queue if they were in it
        this.queue = this.queue.filter(u => u.socket.id !== user1.socket.id && u.socket.id !== user2.socket.id);

        const roomId = `room_${user1.socket.id}_${user2.socket.id}`;

        user1.socket.join(roomId);
        user2.socket.join(roomId);

        this.activeMatches.set(user1.socket.id, user2.socket.id);
        this.activeMatches.set(user2.socket.id, user1.socket.id);

        user1.socket.emit('match_found', {
            roomId,
            peerUid: user2.uid,
            commonInterests: user1.interests.filter(i => user2.interests.includes(i)),
            isInitiator: true  // user1 creates the offer
        });

        user2.socket.emit('match_found', {
            roomId,
            peerUid: user1.uid,
            commonInterests: user2.interests.filter(i => user1.interests.includes(i)),
            isInitiator: false  // user2 receives the offer and sends answer
        });

        console.log(`Matched ${user1.socket.id} with ${user2.socket.id} in room ${roomId}`);
    }

    public removeUser(socketId: string) {
        this.queue = this.queue.filter(u => u.socket.id !== socketId);

        const peerId = this.activeMatches.get(socketId);
        if (peerId) {
            this.activeMatches.delete(socketId);
            this.activeMatches.delete(peerId);
            // Notify peer that the other user left
            // (This will be expanded in the next steps for WebRTC cleanup)
        }
    }

    public getPeerId(socketId: string): string | undefined {
        return this.activeMatches.get(socketId);
    }
}

export const matchmakingManager = new MatchmakingManager();
