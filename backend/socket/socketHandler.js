const setupSocket = (io) => {
  // Store connected users
  const connectedUsers = new Map();
  
  // Store active session locks: { kelasId: { userId, userName, socketId, timestamp } }
  const sessionLocks = new Map();

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join room berdasarkan role
    socket.on('join-role', (data) => {
      const { role, userId, userName } = data;

      // Leave all previous rooms
      socket.rooms.forEach(room => {
        if (room !== socket.id) {
          socket.leave(room);
        }
      });

      // Join new room
      socket.join(role);

      // Store user info
      connectedUsers.set(socket.id, {
        userId,
        userName,
        role,
        socketId: socket.id
      });

      console.log(`Socket ${socket.id} (User: ${userId}, Role: ${role}) joined ${role} room`);
    });

    // Join specific room (untuk ortu yang ingin monitor anak tertentu)
    socket.on('join-student', (studentId) => {
      socket.join(`student-${studentId}`);
      console.log(`Socket ${socket.id} joined student-${studentId} room`);
    });

    // ========================================
    // SESSION LOCK MECHANISM (Concurrency Control)
    // ========================================

    // Lock session saat guru membuka form absensi
    socket.on('lock-session', (data) => {
      const { kelasId, userId, userName } = data;
      
      console.log(`[LOCK REQUEST] Kelas ${kelasId} by User ${userName} (${userId})`);

      // Check if already locked by someone else
      if (sessionLocks.has(kelasId)) {
        const currentLock = sessionLocks.get(kelasId);
        
        // If locked by same user (from different socket/tab), allow and update
        if (currentLock.userId === userId) {
          console.log(`[LOCK UPDATED] User ${userName} already owns lock for Kelas ${kelasId}`);
          sessionLocks.set(kelasId, {
            userId,
            userName,
            socketId: socket.id,
            timestamp: Date.now()
          });
          
          socket.emit('lock-acquired', { kelasId, success: true });
        } else {
          // Locked by different user
          console.log(`[LOCK DENIED] Kelas ${kelasId} is locked by ${currentLock.userName}`);
          socket.emit('lock-denied', {
            kelasId,
            lockedBy: currentLock.userName,
            userId: currentLock.userId
          });
        }
      } else {
        // No lock, acquire it
        sessionLocks.set(kelasId, {
          userId,
          userName,
          socketId: socket.id,
          timestamp: Date.now()
        });

        console.log(`[LOCK ACQUIRED] Kelas ${kelasId} locked by ${userName}`);
        socket.emit('lock-acquired', { kelasId, success: true });

        // Broadcast ke semua user lain bahwa kelas ini sudah di-lock
        socket.broadcast.emit('session-locked', {
          kelasId,
          lockedBy: userName,
          userId
        });
      }
    });

    // Unlock session saat guru menutup form atau submit absensi
    socket.on('unlock-session', (data) => {
      const { kelasId, userId } = data;
      
      console.log(`[UNLOCK REQUEST] Kelas ${kelasId} by User ${userId}`);

      if (sessionLocks.has(kelasId)) {
        const currentLock = sessionLocks.get(kelasId);
        
        // Only allow unlock by owner
        if (currentLock.userId === userId || currentLock.socketId === socket.id) {
          sessionLocks.delete(kelasId);
          console.log(`[UNLOCKED] Kelas ${kelasId} unlocked by ${currentLock.userName}`);
          
          socket.emit('lock-released', { kelasId });
          
          // Broadcast ke semua user bahwa kelas ini sudah bebas
          socket.broadcast.emit('session-unlocked', { kelasId });
        } else {
          console.log(`[UNLOCK DENIED] User ${userId} does not own lock for Kelas ${kelasId}`);
        }
      }
    });

    // Check if session is locked (untuk initial check saat load page)
    socket.on('check-session-lock', (data) => {
      const { kelasId } = data;
      
      if (sessionLocks.has(kelasId)) {
        const lock = sessionLocks.get(kelasId);
        socket.emit('session-locked', {
          kelasId,
          lockedBy: lock.userName,
          userId: lock.userId
        });
      } else {
        socket.emit('session-available', { kelasId });
      }
    });

    // Get all active locks (untuk admin monitoring)
    socket.on('get-active-locks', () => {
      const activeLocks = [];
      sessionLocks.forEach((lock, kelasId) => {
        activeLocks.push({
          kelasId,
          userName: lock.userName,
          userId: lock.userId,
          timestamp: lock.timestamp
        });
      });
      socket.emit('active-locks', activeLocks);
    });

    // ========================================
    // DISCONNECT HANDLER (Auto-unlock)
    // ========================================
    
    // Handle disconnect - auto release locks
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      
      // Release all locks owned by this socket
      const locksToRelease = [];
      sessionLocks.forEach((lock, kelasId) => {
        if (lock.socketId === socket.id) {
          locksToRelease.push(kelasId);
        }
      });

      locksToRelease.forEach(kelasId => {
        const lock = sessionLocks.get(kelasId);
        sessionLocks.delete(kelasId);
        console.log(`[AUTO-UNLOCK] Kelas ${kelasId} auto-unlocked (user ${lock.userName} disconnected)`);
        
        // Broadcast ke semua user bahwa kelas ini sudah bebas
        socket.broadcast.emit('session-unlocked', { kelasId });
      });

      connectedUsers.delete(socket.id);
    });

    // Optional: handle typing indicators, online status, etc
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  // Function untuk emit ke semua admin
  const notifyAdmins = (event, data) => {
    io.to('admin').emit(event, data);
    console.log(`Notified all admins: ${event}`);
  };

  // Function untuk emit ke semua ortu
  const notifyAllParents = (event, data) => {
    io.to('orang_tua').emit(event, data);
    console.log(`Notified all parents: ${event}`);
  };

  // Function untuk emit ke specific student parent
  const notifyParent = (studentId, event, data) => {
    io.to(`student-${studentId}`).emit(event, data);
    console.log(`Notified parent of student ${studentId}: ${event}`);
  };

  // Function untuk get active session locks
  const getActiveLocks = () => {
    const locks = {};
    sessionLocks.forEach((lock, kelasId) => {
      locks[kelasId] = {
        userName: lock.userName,
        userId: lock.userId,
        timestamp: lock.timestamp
      };
    });
    return locks;
  };

  return {
    notifyAdmins,
    notifyAllParents,
    notifyParent,
    connectedUsers,
    getActiveLocks,
    sessionLocks
  };
};

module.exports = setupSocket;
