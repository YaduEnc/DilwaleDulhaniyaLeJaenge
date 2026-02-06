'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
    socket: Socket | null;
    connected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5001';

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, getToken } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        let newSocket: Socket | null = null;

        const connectSocket = async () => {
            if (user) {
                const token = await getToken();

                newSocket = io(SOCKET_URL, {
                    auth: { token }
                });

                newSocket.on('connect', () => {
                    console.log('Socket connected:', newSocket?.id);
                    setConnected(true);
                });

                newSocket.on('disconnect', () => {
                    console.log('Socket disconnected');
                    setConnected(false);
                });

                newSocket.on('connect_error', (err) => {
                    console.error('Socket connection error:', err.message);
                });

                setSocket(newSocket);
            } else {
                if (socket) {
                    socket.disconnect();
                    setSocket(null);
                    setConnected(false);
                }
            }
        };

        connectSocket();

        return () => {
            if (newSocket) {
                newSocket.disconnect();
            }
        };
    }, [user]);

    return (
        <SocketContext.Provider value={{ socket, connected }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (context === undefined) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};
