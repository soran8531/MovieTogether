
import { useEffect, useState, useRef } from 'react';
import './App.css';
import socket from './socket';

function App() {
  const [roomCode, setRoomCode] = useState('');
  const [createdRoom, setCreatedRoom] = useState('');
  const [message, setMessage] = useState('');
  const [connected, setConnected] = useState(socket.connected);
  const [videoUrl, setVideoUrl] = useState('');
  const [currentVideo, setCurrentVideo] = useState('');

  const videoRef = useRef(null);
  const isRemoteAction = useRef(false);

  useEffect(() => {
    function onConnect() {
      setConnected(true);
    }

    function onDisconnect() {
      setConnected(false);
    }

    function onRoomCreated(code) {
      setCreatedRoom(code);
      setRoomCode(code);
      setMessage('اتاق با موفقیت ساخته شد! 🎉');
    }

    function onRoomJoined(code) {
      setCreatedRoom(code);
      setMessage('با موفقیت وارد اتاق شدی! ❤️');
    }

    function onRoomError(error) {
      setMessage(error);
    }

    function onFriendJoined() {
      setMessage('دوستت وارد اتاق شد! 🍿');
    }

    function onFriendLeft() {
      setMessage('دوستت از اتاق خارج شد.');
    }

    function onVideoUrl(data) {
      setVideoUrl(data.url);
      setCurrentVideo(data.url);
      setMessage('دوستت یک فیلم انتخاب کرد! 🍿');
    }

    function onVideoControl(data) {
      const video = videoRef.current;

      if (!video) return;

      isRemoteAction.current = true;

      if (
        Number.isFinite(data.currentTime) &&
        Math.abs(video.currentTime - data.currentTime) > 1
      ) {
        video.currentTime = data.currentTime;
      }

      if (data.action === 'play') {
        const result = video.play();

        if (result && typeof result.catch === 'function') {
          result.catch(() => {
            setMessage('برای پخش فیلم، روی دکمه پخش بزن.');
          });
        }
      }

      if (data.action === 'pause') {
        video.pause();
      }

      if (data.action === 'seek') {
        video.currentTime = data.currentTime;
      }

      setTimeout(() => {
        isRemoteAction.current = false;
      }, 300);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room-created', onRoomCreated);
    socket.on('room-joined', onRoomJoined);
    socket.on('room-error', onRoomError);
    socket.on('friend-joined', onFriendJoined);
    socket.on('friend-left', onFriendLeft);
    socket.on('video-url', onVideoUrl);
    socket.on('video-control', onVideoControl);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room-created', onRoomCreated);
      socket.off('room-joined', onRoomJoined);
      socket.off('room-error', onRoomError);
      socket.off('friend-joined', onFriendJoined);
      socket.off('friend-left', onFriendLeft);
      socket.off('video-url', onVideoUrl);
      socket.off('video-control', onVideoControl);
    };
  }, []);

  function createRoom() {
    if (!socket.connected) {
      setMessage('اتصال به سرور برقرار نیست!');
      return;
    }

    setCreatedRoom('');
    setMessage('در حال ساخت اتاق...');
    socket.emit('create-room');
  }

  function joinRoom() {
    const code = roomCode.trim().toUpperCase();

    if (code.length !== 6) {
      setMessage('کد اتاق باید ۶ حرف یا عدد باشد.');
      return;
    }

    if (!socket.connected) {
      setMessage('اتصال به سرور برقرار نیست!');
      return;
    }

    setCreatedRoom('');
    setMessage('در حال ورود به اتاق...');
    socket.emit('join-room', code);
  }

  function loadVideo() {
    const url = currentVideo.trim();

    if (!url) {
      setMessage('لطفاً لینک مستقیم فیلم را وارد کن.');
      return;
    }

    if (!createdRoom) {
      setMessage('ابتدا وارد یک اتاق شو.');
      return;
    }

    try {
      const parsedUrl = new URL(url);

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        setMessage('لینک فیلم معتبر نیست.');
        return;
      }
    } catch {
      setMessage('لطفاً یک لینک معتبر وارد کن.');
      return;
    }

    setVideoUrl(url);
    setMessage('لینک فیلم برای دوستت ارسال شد! 🎬');

    socket.emit('video-url', {
      roomCode: createdRoom,
      url
    });
  }

  function sendVideoControl(action) {
    if (isRemoteAction.current || !createdRoom) return;

    const video = videoRef.current;

    if (!video) return;

    socket.emit('video-control', {
      roomCode: createdRoom,
      action,
      currentTime: video.currentTime
    });
  }

  function handleSeek() {
    sendVideoControl('seek');
  }

  function copyCode() {
    navigator.clipboard.writeText(createdRoom);
    setMessage('کد اتاق کپی شد!');
  }

  return (
    <div className="app">
      <nav className="navbar">
        <h2>🎬 MovieTogether</h2>
        <span>تماشای فیلم با هم</span>
      </nav>

      <main className="hero">
        <div className="hero-content">
          <span className="tag">🍿 تجربه سینمای دونفره</span>

          <h1>
            فاصله مهم نیست،
            <br />
            <span>با هم فیلم ببینید!</span>
          </h1>

          <p>
            اتاق بساز، دوستت را دعوت کن و فیلم موردعلاقه‌تان را
            هم‌زمان تماشا کنید.
          </p>

          <div className="connection-status">
            <span className={connected ? 'online' : 'offline'}></span>
            {connected ? 'متصل به سرور' : 'در حال اتصال به سرور...'}
          </div>

          {!createdRoom && (
            <div className="actions">
              <button className="primary" onClick={createRoom}>
                ساخت اتاق جدید +
              </button>

              <div className="join-box">
                <input
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  placeholder="کد اتاق دوستت..."
                  maxLength={6}
                />

                <button onClick={joinRoom}>ورود به اتاق</button>
              </div>
            </div>
          )}

          {message && <p className="room-message">{message}</p>}

          {createdRoom && (
            <div className="room-card">
              <h3>🎉 اتاق شما آماده است!</h3>
              <p>کد اختصاصی اتاق:</p>

              <div className="room-code">{createdRoom}</div>

              <button className="primary" onClick={copyCode}>
                کپی کد دعوت
              </button>
            </div>
          )}

          {createdRoom && (
            <section className="movie-section">
              <h2>🎬 انتخاب فیلم</h2>

              <div className="join-box">
                <input
                  value={currentVideo}
                  onChange={(e) => setCurrentVideo(e.target.value)}
                  placeholder="لینک مستقیم فیلم را وارد کن..."
                  dir="ltr"
                />

                <button onClick={loadVideo}>بارگذاری فیلم</button>
              </div>

              {videoUrl && (
                <div className="video-container">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    onPlay={() => sendVideoControl('play')}
                    onPause={() => sendVideoControl('pause')}
                    onSeeked={handleSeek}
                    style={{
                      width: '100%',
                      borderRadius: '12px',
                      background: '#000'
                    }}
                  />
                  <p>
                    🍿 کنترل‌های پخش برای دوستت هم ارسال می‌شوند.
                  </p>
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      <footer>ساخته شده برای لحظه‌های سینمایی ❤️</footer>
    </div>
  );
}

export default App;
