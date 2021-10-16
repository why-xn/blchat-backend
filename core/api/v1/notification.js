var { Notification } = require('../../../db/model/models');
var sio = require('../../../socket.io/socket');
const { 
    v4: uuidv4,
  } = require('uuid');

module.exports = {
    create: async function (type, payload) {
        if (type === 'NOTIFICATION_NEW_PRIVATE_CHAT_REQUEST' || type === 'NOTIFICATION_PRIVATE_CHAT_REQUEST_APPROVED') {
            const uid = uuidv4();
            Notification.create({
                id: uid,
                userId: payload.userId,
                msg: payload.msg,
                targetPage: 'PRIVATE_CHAT',
                targetId: payload.chatId,
                clicked: false,
                status: 'V',
                createDate: new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"})
            });
            sio.getSocketIO().to(otherParticipant.id).emit("notification-channel", {id: uid, code: type, targetType: 'PRIVATE_CHAT', targetId: payload.chatId, msg: payload.msg});
        }
    }
};