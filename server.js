
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);

app.use(cors());
app.use(express.json());

// بررسی نصب FFmpeg
execFile('ffmpeg', ['-version'], { timeout: 10000 }, (error, stdout) => {
  if (error) {
    console.error('FFmpeg is NOT available:', error.message);
    return;
  }

  console.log('FFmpeg is available:', stdout.split('\n')[0]);
});

// بررسی دسترسی سرور به لینک نمونه MKV
async function checkVideoSource() {
  const videoUrl =
    'https://bnrhd3fvb374s4bkwzxm54xf.abrtech.top/pnot/Movie/2026/Steps.2026/Sub/Steps.2026.720p.WEB-DL.YIFY.Farsi.Sub.Film2Media.mkv?v=744579653857';

  console.log('Checking MKV source access...');

  try {
    const response = await fetch(videoUrl, {
      method: 'GET',
      headers: {
        Range: 'bytes=0-0'
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'manual'
    });

    console.log('MKV source HTTP status:', response.status);
    console.log('MKV source content-type:',
      response.headers.get('content-type'));
    console.log('MKV source content-length:',
      response.headers.get('content-length'));
    console.log('MKV source content-range:',
      response.headers.get('content-range'));
    console.log('MKV source accept-ranges:',
      response.headers.get('accept-ranges'));

    if (response.body) {
      await response.body.cancel();
    }

    if (response.status === 206) {
      console.log('MKV source supports HTTP Range requests.');
    } else if (response.status === 200) {
      console.log('WARNING: Source did not honor the Range request.');
    } else {
      console.log('WARNING: MKV source returned an unexpected status.');
    }
  } catch (error) {
    console.error('MKV source check failed:', error.message);
  }
}

checkVideoSource();

// نمایش فایل‌های ساخته‌شده React
const distPath = path.join(__dirname, 'dist');

app.use(express.static(distPath));

app.get('/health', (req, res) => {
  res.send('MovieTogether Server is running 🎬');
});

// نمایش صفحه React برای مسیرهای سایت
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// راه‌اندازی Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const rooms = new Map();

function generateRoomCode() {
  let code;

  do {
    code = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();
  } while (rooms.has(code));

  return code;
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // ارسال لینک فیلم
  socket.on('video-url', (data) => {
    const roomCode = String(data?.roomCode || '')
      .trim()
      .toUpperCase();

    const url = String(data?.url || '').trim();
    const room = rooms.get(roomCode);

    if (!room || !room.has(socket.id)) return;
    if (!url || url.length > 2000) return;

    socket.to(roomCode).emit('video-url', { url });

    console.log('Video URL sent:', roomCode);
  });

  // ساخت اتاق
  socket.on('create-room', () => {
    const code = generateRoomCode();

    rooms.set(code, new Set([socket.id]));
    socket.join(code);

    socket.emit('room-created', code);

    console.log('Room created:', code);
  });

  // ورود به اتاق
  socket.on('join-room', (code) => {
    const roomCode = String(code || '')
      .trim()
      .toUpperCase();

    if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
      socket.emit('room-error', 'کد اتاق معتبر نیست.');
      return;
    }

    const room = rooms.get(roomCode);

    if (!room) {
      socket.emit('room-error', 'این اتاق وجود ندارد.');
      return;
    }

    if (room.size >= 2) {
      socket.emit('room-error', 'ظرفیت اتاق تکمیل است.');
      return;
    }

    room.add(socket.id);
    socket.join(roomCode);

    socket.emit('room-joined', roomCode);
    socket.to(roomCode).emit('friend-joined');

    console.log('User joined:', roomCode);
  });

  // چت
  socket.on('chat-message', (data) => {
    const roomCode = String(data?.roomCode || '')
      .toUpperCase();

    const message = String(data?.message || '').trim();

    if (
      !rooms.has(roomCode) ||
      !rooms.get(roomCode).has(socket.id) ||
      !message ||
      message.length > 500
    ) {
      return;
    }

    io.to(roomCode).emit('new-message', {
      sender: socket.id,
      message,
      time: new Date().toLocaleTimeString('fa-IR')
    });
  });

  // هماهنگی پخش فیلم
  socket.on('video-control', (data) => {
    const roomCode = String(data?.roomCode || '')
      .toUpperCase();

    const room = rooms.get(roomCode);

    if (!room || !room.has(socket.id)) return;

    const { action, currentTime } = data;

    if (!['play', 'pause', 'seek'].includes(action)) return;

    if (
      action === 'seek' &&
      (!Number.isFinite(currentTime) ||
        currentTime < 0 ||
        currentTime > 86400)
    ) {
      return;
    }

    socket.to(roomCode).emit('video-control', {
      action,
      currentTime
    });
  });

  // قطع اتصال
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    for (const [code, room] of rooms.entries()) {
      if (room.has(socket.id)) {
        room.delete(socket.id);

        socket.to(code).emit('friend-left');

        if (room.size === 0) {
          rooms.delete(code);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`MovieTogether server running on port ${PORT}`);
});
