'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
    socket: Socket | null;
    connected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:10000';

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, getToken } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (user && getToken) {
            const connect = async () => {
                const token = await getToken();
                if (!token) return;

                if (socketRef.current) {
                    socketRef.current.disconnect();
                }

                const newSocket = io(SOCKET_URL, {
                    auth: { token },
                });

                newSocket.on('connect', () => {
                    console.log('Connected to socket server');
                    setConnected(true);
                });

                newSocket.on('disconnect', () => {
                    console.log('Disconnected from socket server');
                    setConnected(false);
                });

                socketRef.current = newSocket;
                setSocket(newSocket);
            };

            connect();
        } else {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
                setSocket(null);
                setConnected(false);
            }
        }

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [user, getToken]);

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
