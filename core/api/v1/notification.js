var { Notification } = require('../../../db/model/models');
var sio = require('../../../socket.io/socket');
const { 
    v4: uuidv4,
  } = require('uuid');

module.exports = {
    create: async function (type, payload) {
        if (type === 'NOTIFICATION_NEW_PRIVATE_CHAT_REQUEST' || type === 'NOTIFICATION_PRIVATE_CHAT_REQUEST_APPROVED' || type === 'NOTIFICATION_PRIVATE_CHAT_REQUEST_REJECTED' || type === 'NOTIFICATION_PRIVATE_CHAT_BLOCKED') {
            const uid = uuidv4();
            Notification.create({
                id: uid,
                userId: payload.userId,
                code: type,
                msg: payload.msg,
                targetType: 'PRIVATE_CHAT',
                targetId: payload.chatId,
                clicked: false,
                status: 'V',
                createDate: new Date().toISOString()
            });
            sio.getSocketIO().to(payload.userId).emit("notification-channel", {id: uid, code: type, targetType: 'PRIVATE_CHAT', targetId: payload.chatId, msg: payload.msg});
        }
    }
};