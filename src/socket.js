
import { io } from 'socket.io-client';

const socket = io('https://movietogether-8kcs.onrender.com', {
  autoConnect: true,
  transports: ['websocket', 'polling']
});

export default socket;
