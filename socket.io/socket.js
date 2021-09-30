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

function getChatType(chatId) {
  return chatId.substring(0, 2) === 'pc' ? 'P' : 'G';
}

async function saveChatMessage (chatId, chatType, msg, senderId, senderDisplayName, createDate) {
    const newMessage = new ChatMessage({
      id: uuidv4(),
      chatId: chatId,
      //chatType: chatType,
      msg: msg,
      senderId: senderId,
      senderDisplayName: senderDisplayName,
      status: 'V',
      createDate: createDate
    });

    if(chatType == 'P') {
      const existingPrivateChat = await PrivateChat.findOne({ id: chatId });
      existingPrivateChat.lastMessage = {
        msg: msg,
        sender: senderId,
        date: createDate,
        seenByRecipient: false
      }
      existingPrivateChat.save();
    } 

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
          
              // join self channel
              socket.join(socket.user.id);

              socket.on("disconnect", (reason) => {
                console.log('Socket disconnected - ', socket.id, ':', reason);
                if (socket.user) {
                    socket.leave(socket.user.id);
                }
              });
              
              // join public group chat
              socket.on('join', async function (input) {
                const chatType = getChatType(input.chatId);
                if (chatType === 'G') {
                  var publicGroupChat = await GroupChat.findOne({id: input.chatId, mode: 'PUBLIC', status: 'V'});
                  if (publicGroupChat) {
                    socket.join(input.chatId);
                    //saveChatMessage(publicGroupChatId, 'GROUP', socket.user.displayName + ' just joined the room!', 'server', 'Server');
                    io.to(input.chatId).emit("msg-channel", {code: 'GROUP_CHAT_ANNOUNCEMENT', chatId: input.chatId, msg: socket.user.displayName + ' just joined the room!', senderId: 'server', senderDisplayName: 'Server'});
                  } else {
                    //socket.broadcast.to(socket.id).emit( "msg-channel", {type: 'JOIN_GROUP_CHAT_FAILED', data: publicGroupChat, msg: 'Group Chat not found'} );
                    socket.emit("msg-channel", {code: 'JOIN_GROUP_CHAT_FAILED', chatId: input.chatId, msg: 'Group Chat not found'});
                  }
                } else {
                  var privateChat = await PrivateChat.findOne({id: input.chatId, "participants.id": socket.user.id, status: 'V'});
                  if (privateChat) {
                    socket.join(input.chatId);
                  } else {
                    socket.emit("msg-channel", {code: 'JOIN_PRIVATE_CHAT_FAILED', chatId: input.chatId, msg: 'Private Chat not found'});
                  }
                }
                
              });
          
              
              // leave public group chat
              socket.on('leave', async function (publicGroupChatId) {
                var publicGroupChat = await GroupChat.findOne({id: publicGroupChatId, mode: 'PUBLIC', status: 'V'});
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
                
                const chatType = getChatType(incomingData.chatId);

                // checking permission
                const chatInfo = await cache.hgetall(incomingData.chatId);
                if (chatInfo && chatType == 'G' && chatInfo.chatType == 'G') {
                  // do nothing
                } else if (!chatInfo && chatType == 'G') {
                  var publicGroupChat = await GroupChat.findOne({id: incomingData.chatId, mode: 'PUBLIC', status: 'V'});
                  if (!publicGroupChat) {
                    return;
                  }
                  cache.getClient().hset(incomingData.chatId, 'id', publicGroupChat.id, 'chatType', 'G', 'groupMode', 'PUBLIC');
                  cache.getClient().expire(incomingData.chatId, 600);
                } else if (chatInfo && chatInfo.chatType != 'G' && chatType != 'G') {
                  if (!chatInfo.participantsInStr.includes(socket.user.id)) {
                    return
                  }
                } else if (!chatInfo && chatType != 'G') {
                  var privateChat = await PrivateChat.findOne({id: incomingData.chatId, status: 'V'});
                  if (!privateChat || privateChat.state !== 'APPROVED') {
                    io.to(socket.user.id).emit("msg-channel", {code: 'PERMISSION_DENIED', chatId: privateChat.id, msg: 'You reqeust for private chat has not been accepted yet', senderId: 'server', senderDisplayName: 'Server'});
                    return;
                  }
                  if (!privateChat.participantsInStr.includes(socket.user.id)) {
                    return;
                  }
                  
                  cache.getClient().hset(privateChat.id, 'id', privateChat.id, 'chatType', chatType, 'participantsInStr', privateChat.participantsInStr);
                  cache.getClient().expire(privateChat.id, 600);
                }
          
                const dateTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"})
                const chatMsg = await saveChatMessage(incomingData.chatId, chatType, incomingData.msg, socket.user.id, socket.user.displayName, dateTime);
                io.to(incomingData.chatId).emit("msg-channel", {
                  code: 'NEW_CHAT_MSG',
                  chatId: incomingData.chatId, 
                  msgId: chatMsg.id,
                  msg: incomingData.msg,
                  senderId: socket.user.id, 
                  senderDisplayName: socket.user.displayName,
                  sentAt: dateTime
                });
              });
            }
          });

    },
    getSocketIO: () => {
        return io;
    }
}