
import { io } from 'socket.io-client';

const serverURL = import.meta.env.PROD
  ? window.location.origin
  : 'http://localhost:3001';

const socket = io(serverURL, {
  autoConnect: true,
  transports: ['websocket', 'polling']
});

export default socket;
