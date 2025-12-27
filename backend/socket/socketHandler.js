const setupSocket = (io) => {
  // Store connected users
  const connectedUsers = new Map();

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join room berdasarkan role
    socket.on('join-role', (data) => {
      const { role, userId } = data;

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

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
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

  return {
    notifyAdmins,
    notifyAllParents,
    notifyParent,
    connectedUsers
  };
};

module.exports = setupSocket;
