import { adminAuth } from '../auth/firebaseAdmin.js';
import { Socket } from 'socket.io';

export const socketAuthMiddleware = async (socket: Socket, next: (err?: Error) => void) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error('Authentication error: No token provided'));
    }

    try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        (socket as any).user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
        };
        next();
    } catch (error) {
        console.error('Socket authentication failed:', error);
        next(new Error('Authentication error: Invalid token'));
    }
};
