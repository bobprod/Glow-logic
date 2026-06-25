import { io, Socket } from 'socket.io-client';
import { API_BASE, getAuthToken } from './config';

const URL = process.env.NEXT_PUBLIC_SOCKET_URL || API_BASE;

export const socket: Socket = io(URL, {
    autoConnect: typeof window !== 'undefined',
    auth: async (callback) => {
        callback({ token: await getAuthToken() });
    },
});
