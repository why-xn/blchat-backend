var cors = require('cors');
require("dotenv").config();
const jwt = require("jsonwebtoken");
var cache = require("../cache/redis");
var { GroupChat, PrivateChat, ChatMessage } = require('../db/model/models');
const { 
    v4: uuidv4,
  } = require('uuid');
var io;

const config = process.env;

async function saveChatMessage (chatId, chatType, msg, senderId, senderDisplayName) {
    const newMessage = new ChatMessage({
      _id: uuidv4(),
      chatId: chatId,
      chatType: chatType,
      msg: msg,
      senderId: senderId,
      senderDisplayName: senderDisplayName,
      status: 'V',
      createDate: new Date()
    });
    await newMessage.save();
    return newMessage;
  }

module.exports = {
    init: async (httpServer) => {
        io = require('socket.io')(httpServer, {
            cors: {
                origin: "*",
                methods: ["*"]
            }
        });

        io.use((socket, next) => {
            const token = socket.handshake.auth.token;
            try {
              const decoded = jwt.verify(token, config.TOKEN_KEY);
              socket.user = decoded;
              next();
            } catch (err) {
              err = new Error("not authorized");
              err.data = { msg: "invalid token" }; 
              next(err);
            }
          });
          
          io.on('connection', (socket) => {
            if (!socket.user) {
              setTimeout(() => {
                socket.disconnect();
              }, 500);
            } else {
              console.log('User: ' + socket.user.displayName + ' just connected. Socket ID: ' + socket.id);
          
              socket.join(socket.user.userId);

              socket.on("disconnect", (reason) => {
                console.log('Socket disconnected - ', socket.id, ':', reason);
                if (socket.user) {
                    socket.leave(socket.user.userId);
                }
              });
              
              // join public group chat
              socket.on('join', async function (publicGroupChatId) {
                var publicGroupChat = await GroupChat.findOne({_id: publicGroupChatId, mode: 'PUBLIC', status: 'V'});
                if (publicGroupChat) {
                  socket.join(publicGroupChatId);
                  //saveChatMessage(publicGroupChatId, 'GROUP', socket.user.displayName + ' just joined the room!', 'server', 'Server');
                  io.to(publicGroupChatId).emit("msg-channel", {code: 'GROUP_CHAT_ANNOUNCEMENT', chatId: publicGroupChatId, msg: socket.user.displayName + ' just joined the room!', senderId: 'server', senderDisplayName: 'Server'});
                } else {
                  //socket.broadcast.to(socket.id).emit( "msg-channel", {type: 'JOIN_GROUP_CHAT_FAILED', data: publicGroupChat, msg: 'Group Chat not found'} );
                  socket.emit("msg-channel", {code: 'JOIN_GROUP_CHAT_FAILED', chatId: publicGroupChatId, msg: 'Group Chat not found'});
                }
              });
          
              
              // leave public group chat
              socket.on('leave', async function (publicGroupChatId) {
                var publicGroupChat = await GroupChat.findOne({_id: publicGroupChatId, mode: 'PUBLIC', status: 'V'});
                if (publicGroupChat) {
                  socket.leave(publicGroupChatId);
                  //saveChatMessage(publicGroupChatId, 'GROUP', socket.user.displayName + ' just left the room!', 'server', 'Server');
                  io.to(publicGroupChatId).emit("msg-channel", {code: 'GROUP_CHAT_ANNOUNCEMENT', chatId: publicGroupChatId, msg: socket.user.displayName + ' just left the room!', senderId: 'server', senderDisplayName: 'Server'});
                } else {
                  //socket.broadcast.to(socket.id).emit( "msg-channel", {type: 'JOIN_GROUP_CHAT_FAILED', data: publicGroupChat, msg: 'Group Chat not found'} );
                  socket.emit("msg-channel", {code: 'LEAVE_GROUP_CHAT_FAILED', chatId: publicGroupChatId, msg: 'Group Chat not found'});
                }
              });
          
          
              // on msg from client
              socket.on('msg-channel', async incomingData => {
                console.log(incomingData);
          
                // checking permission
                const chatInfo = await cache.hgetall(incomingData.chatId);
                if (chatInfo && incomingData.chatType == 'GROUP' && chatInfo.chatType == 'GROUP') {
                  // do nothing
                } else if (!chatInfo && incomingData.chatType == 'GROUP') {
                  var publicGroupChat = await GroupChat.findOne({_id: incomingData.chatId, mode: 'PUBLIC', status: 'V'});
                  if (!publicGroupChat) {
                    return;
                  }
                  cache.getClient().hset(incomingData.chatId, '_id', publicGroupChat._id, 'chatType', 'GROUP', 'groupMode', 'PUBLIC');
                  cache.getClient().expire(incomingData.chatId, 600);
                } else if (chatInfo && chatInfo == 'PRIVATE' && incomingData.chatType == 'PRIVATE') {
                  if (!chatInfo.participantsInStr.includes(socket.user.userId)) {
                    return
                  }
                } else if (!chatInfo && incomingData.chatType == 'PRIVATE') {
                  var privateChat = await PrivateChat.findOne({_id: incomingData.chatId, status: 'V'});
                  if (!privateChat || privateChat.state !== 'APPROVED') {
                    return;
                  }
                  if (!chatInfo.participantsInStr.includes(socket.user.userId)) {
                    return;
                  }
                  
                  cache.getClient().hset(privateChat, '_id', privateChat._id, 'chatType', 'PRIVATE', 'participantsInStr', privateChat.participantsInStr);
                  cache.getClient().expire(privateChat._id, 600);
                }
          
          
                const chatMsg = await saveChatMessage(incomingData.chatId, incomingData.chatType, incomingData.msg, socket.user.userId, socket.user.displayName);
                io.to(incomingData.chatId).emit("msg-channel", {
                  code: 'NEW_CHAT_MSG',
                  chatId: incomingData.chatId, 
                  msgId: chatMsg._id,
                  msg: incomingData.msg,
                  senderId: socket.user.userId, 
                  senderDisplayName: socket.user.displayName
                });
              });
            }
          });

    },
    getSocketIO: () => {
        return io;
    }
}