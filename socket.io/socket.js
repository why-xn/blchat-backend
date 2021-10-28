var cors = require('cors');
require("dotenv").config();
const jwt = require("jsonwebtoken");
const axios = require('axios');
var cache = require("../cache/redis");
var { GroupChat, PrivateChat, ChatMessage, User, GroupChatParticipant } = require('../db/model/models');
const { 
    v4: uuidv4,
  } = require('uuid');
var io;

const config = process.env;

function getChatType(chatId) {
  return chatId.substring(0, 2) === 'pc' ? 'P' : 'G';
}

async function saveChatMessage (chatId, chatType, msg, senderId, senderDisplayName, createDate) {
  try {
    if(chatType == 'P') {
      const existingPrivateChat = await PrivateChat.findOne({ id: chatId, status: 'V' });
      existingPrivateChat.lastMessage = {
        msg: msg,
        sender: senderId,
        date: createDate,
        seenByRecipient: false
      }
      existingPrivateChat.save();
    } 

    const newMessage  = await ChatMessage.create({
      id: uuidv4(),
      chatId: chatId,
      //chatType: chatType,
      msg: msg,
      senderId: senderId,
      senderDisplayName: senderDisplayName,
      status: 'V',
      createDate: createDate
    });
    return newMessage;
  } catch(err) {
    console.log(err);
    return null;
  }
}

module.exports = {
    init: async (httpServer) => {
        io = require('socket.io')(httpServer, {
            cors: {
                origin: "*",
                methods: ["*"]
            }
        });

        // authentication middleware
        io.use(async (socket, next) => {
          var token = socket.handshake.auth.token;
          if (!token) {
            token = socket.handshake.query.token;
          }

          try {
            const decoded = jwt.verify(token, config.TOKEN_KEY);
            socket.user = decoded;
            return next();
          } catch (err) {
            
          }

          try {
            var user = await cache.hgetall(token);
            if (user && user.id) {
              socket.user = user;
              return next();
            }
      
            let data = {};
            let config = {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
              }
            }
            
            const response = await axios.post(process.env.THIRD_PARTY_AUTH_CHECK_API, data, config);
            if (response && response.data && response.data.data && response.data.data.id) {
              user = {
                id: response.data.data.id.toString(),
                displayName: response.data.data.displayName,
                displayPicture: response.data.data.displayPicture != null ? response.data.data.displayPicture : "",
                username: response.data.data.username,
                role: response.data.data.role != null ? response.data.data.role.toUpperCase() : 'VISITOR',
              }
              socket.user = user;
      
              cache.getClient().hset(token, 'id', user.id, 'displayName', user.displayName, 'displayPicture', user.displayPicture, 'username', user.username, 'role', user.role);
              cache.getClient().expire(token, 600);

              const oldUser = await User.findOne({ username: user.username, status: 'V'});
              if (!oldUser) {
                // Create user in our database
                await User.create({
                  id: user.id,
                  displayName: user.displayName,
                  username: user.username,
                  password: '',
                  role: user.role,
                  status: 'V',
                  createDate: new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"})
                }); 
              }
              return next();

            } else {
              err = new Error("not authorized");
              err.data = { msg: "user not found" }; 
              next(err);
            }
          } catch(err) {
            //console.log(err);
            err = new Error("not authorized");
            err.data = { msg: "invalid token" }; 
            next(err);
          }
        });
          

        // on new connection
        io.on('connection', (socket) => {
          if (!socket.user || !socket.user.id) {
            setTimeout(() => {
              socket.disconnect();
            }, 500);
          } else {
            console.log('User: ' + socket.user.displayName + ' (' + socket.user.id + ') just connected. Socket ID: ' + socket.id);
        
            // join self channel
            socket.join(socket.user.id);

            setTimeout(() => {
              socket.emit("msg-channel", {code: 'WELCOME', chatId: null, msg: 'Welcome to chat'});
            }, 100);

            socket.on("disconnect", (reason) => {
              console.log('Socket disconnected - ', socket.id, ':', reason);
              if (socket.user) {
                  socket.leave(socket.user.id);
              }
            });
            
            // join public group chat
            socket.on('join', async function (input) {
              console.log('[DEBUG] request to join public group. ', socket.user.id, input.chatId);
              console.log('[DEBUG] Input: ', JSON.stringify(input));
              if (!input || !input.chatId) {
                return;
              }
              const chatType = getChatType(input.chatId);
              if (chatType === 'G') {
                var publicGroupChat = await GroupChat.findOne({id: input.chatId, mode: 'PUBLIC', status: 'V'});
                if (publicGroupChat) {
                  if (socket.user.role !== 'ADMIN' && !publicGroupChat.allowedRoles.includes(socket.user.role)) {
                    socket.emit("msg-channel", {code: 'JOIN_GROUP_CHAT_FAILED', chatId: input.chatId, msg: 'Permission denied'});
                  } else {
                    socket.join(input.chatId);
                    //saveChatMessage(publicGroupChatId, 'GROUP', socket.user.displayName + ' just joined the room!', 'server', 'Server');
                    socket.emit("msg-channel", {code: 'JOIN_GROUP_CHAT_SUCCESS', chatId: input.chatId, msg: 'Joined group chat'});
                    io.to(input.chatId).emit("msg-channel", {code: 'GROUP_CHAT_ANNOUNCEMENT', chatId: input.chatId, msg: socket.user.displayName + ' just joined the room!', senderId: 'server', senderDisplayName: 'Server'});

                    // updating group chat participants
                    var groupChatParticipant = await GroupChatParticipant.findOne({chatId: input.chatId, 'participant.id': socket.user.id});
                    if (groupChatParticipant) {
                      groupChatParticipant.participant.activeConnections++;
                      groupChatParticipant.save();
                    } else {
                      GroupChatParticipant.create({
                          id: uuidv4(),
                          chatId: input.chatId,
                          participant: {
                            id: socket.user.id,
                            displayName: socket.user.displayName,
                            role: socket.user.role,
                            username: socket.user.username,
                            activeConnections: 1
                          },
                          status: 'V',
                          createDate: new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"})
                      });
                    }
                  }
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
                socket.emit("msg-channel", {code: 'LEAVE_GROUP_CHAT_SUCCESS', chatId: publicGroupChatId, msg: 'Left group chat'});
                io.to(publicGroupChatId).emit("msg-channel", {code: 'GROUP_CHAT_ANNOUNCEMENT', chatId: publicGroupChatId, msg: socket.user.displayName + ' just left the room!', senderId: 'server', senderDisplayName: 'Server'});

                // updating group chat participants
                var groupChatParticipant = await GroupChatParticipant.findOne({chatId: publicGroupChatId, 'participant.id': socket.user.id});
                if (groupChatParticipant) {
                  groupChatParticipant.participant.activeConnections--;
                  if (groupChatParticipant.participant.activeConnections < 0) {
                    groupChatParticipant.participant.activeConnections = 0;
                  }
                  groupChatParticipant.save();
                }

              } else {
                //socket.broadcast.to(socket.id).emit( "msg-channel", {type: 'JOIN_GROUP_CHAT_FAILED', data: publicGroupChat, msg: 'Group Chat not found'} );
                socket.emit("msg-channel", {code: 'LEAVE_GROUP_CHAT_FAILED', chatId: publicGroupChatId, msg: 'Group Chat not found'});
              }
            });
                  
            // on msg from client
            socket.on('msg-channel', async incomingData => {
              try {
                console.log('[DEBUG] NEW_CHAT_MSG:', JSON.stringify(incomingData));

                if (!incomingData.chatId || !incomingData.msg) {
                  return;
                }
                
                const chatType = getChatType(incomingData.chatId);

                var destination = incomingData.chatId;

                // checking permission
                const chatInfo = await cache.hgetall(incomingData.chatId);
                if (chatInfo && chatType == 'G' && chatInfo.chatType == 'G') {
                  // do nothing
                } else if (!chatInfo && chatType == 'G') {
                  var publicGroupChat = await GroupChat.findOne({id: incomingData.chatId, mode: 'PUBLIC', status: 'V'});
                  if (!publicGroupChat || (socket.user.role !== 'ADMIN' && !publicGroupChat.allowedRoles.includes(socket.user.role))) {
                    return;
                  }
                  cache.getClient().hset(incomingData.chatId, 'id', publicGroupChat.id, 'chatType', 'G', 'groupMode', 'PUBLIC');
                  cache.getClient().expire(incomingData.chatId, 600);

                } else if (chatInfo && chatInfo.chatType != 'G' && chatType != 'G') {
                  if (!chatInfo.participantsInStr.includes(socket.user.id)) {
                    return
                  }

                  console.log('[DEBUG] Cached Chat Info:', chatInfo);

                  destination = chatInfo.p1;
                  if (destination == socket.user.id) {
                    destination = chatInfo.p2;
                  }
                } else if (!chatInfo && chatType != 'G') {
                  var privateChat = await PrivateChat.findOne({id: incomingData.chatId, status: 'V'});
                  if (!privateChat || privateChat.state !== 'APPROVED') {
                    if (privateChat.state === 'BLOCKED') {
                      io.to(socket.id).emit("msg-channel", {code: 'PERMISSION_DENIED', chatId: privateChat.id, msg: 'You cannot reply to this conversation anymore', senderId: 'server', senderDisplayName: 'Server'});
                    } else {
                      io.to(socket.id).emit("msg-channel", {code: 'PERMISSION_DENIED', chatId: privateChat.id, msg: 'You reqeust for private chat has not been accepted yet', senderId: 'server', senderDisplayName: 'Server'});
                    }
                    return;
                  }
                  if (!privateChat.participantsInStr.includes(socket.user.id)) {
                    return;
                  }
                  
                  cache.getClient().hset(privateChat.id, 'id', privateChat.id, 'chatType', chatType, 'participantsInStr', privateChat.participantsInStr, 'p1', privateChat.participants[0].id, 'p2', privateChat.participants[1].id);
                  cache.getClient().expire(privateChat.id, 600);

                  destination = privateChat.participants[0].id;
                  if (destination == socket.user.id) {
                    destination = privateChat.participants[1].id;
                  }
                }
          
                const dateTime = new Date();
                const chatMsg = await saveChatMessage(incomingData.chatId, chatType, incomingData.msg, socket.user.id, socket.user.displayName, dateTime.toISOString());

                if (chatMsg == null) {
                  io.to(socket.id).emit("msg-channel", {code: 'FAILED_NEW_CHAT_MSG', chatId: privateChat.id, msg: 'Error occurred sending msg.', senderId: 'server', senderDisplayName: 'Server'});
                  return;
                }
                
                console.log('[DEBUG] destination:', destination);

                io.to(destination).emit("msg-channel", {
                  code: 'NEW_CHAT_MSG',
                  chatId: incomingData.chatId, 
                  msgId: chatMsg.id,
                  msg: incomingData.msg,
                  senderId: socket.user.id, 
                  senderDisplayName: socket.user.displayName,
                  sentAt: dateTime.toISOString()
                });

                if (chatType != 'G') {
                  io.to(socket.user.id).emit("msg-channel", {
                    code: 'NEW_CHAT_MSG',
                    chatId: incomingData.chatId, 
                    msgId: chatMsg.id,
                    msg: incomingData.msg,
                    senderId: socket.user.id, 
                    senderDisplayName: socket.user.displayName,
                    sentAt: dateTime.toISOString()
                  });
                }
              } catch(err) {
                console.log('Failed to send message', err);
                io.to(socket.id).emit("msg-channel", {code: 'FAILED_NEW_CHAT_MSG', chatId: privateChat.id, msg: 'You reqeust for private chat has not been accepted yet', senderId: 'server', senderDisplayName: 'Server'});
              }              
            });
          }
        });
    },
    getSocketIO: () => {
        return io;
    }
}