const jwt = require("jsonwebtoken");
const axios = require('axios');
var cache = require("../cache/redis");
var { User, PrivateChat, GroupChatParticipant, ChatMessage } = require('../db/model/models');

const config = process.env;

const verifyToken = async (req, res, next) => {
  var thirdPartyToken = true;
  var token = req.body.token || req.query.token || req.headers["x-access-token"];
  
  if (!token) {
    token = req.headers["xxx-access-token"];
    if (token) {
      thirdPartyToken = false;
    } else {
      return res.status(403).send("A token is required for authentication");
    }
  }
  
  if (thirdPartyToken) {
    try {

      var user = await cache.hgetall(token);
      if (user && user.id) {
        req.user = user;
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
        req.user = user;

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
        } else if(oldUser && user.displayName !== oldUser.displayName) {
          console.log("[DEBUG] Updating user displayname in User Model.", oldUser.displayName, "-->", user.displayName);
          oldUser.displayName = user.displayName;
          oldUser.save();

          try {
            console.log("[DEBUG] Updating user displayname in Private Chat Model.", oldUser.displayName, "-->", user.displayName);
            let privateChatList = await PrivateChat.find({"participants.id": user.id, status: 'V'});
            for (let i = 0; i < privateChatList.length; i++) {
              for (let j = 0; j < privateChatList[i].participants.length; j++) {
                if (privateChatList[i].participants[j].id == user.id) {
                  privateChatList[i].participants[j].displayName = user.displayName;
                  break;
                }
              }
              privateChatList[i].save();
            }
          } catch(err) {
            console.log('[DEBUG] Error while updating user displayname in Private Chat Model.', err);
          }
          
          try {
            console.log("[DEBUG] Updating user displayname in Group Chat Participants Model.", oldUser.displayName, "-->", user.displayName);
            let groupChatParticipantList = await GroupChatParticipant.find({"participant.id": user.id, status: 'V'});
            for (let i = 0; i < groupChatParticipantList.length; i++) {
              if (groupChatParticipantList[i].participant.id == user.id) {
                groupChatParticipantList[i].participant.displayName = user.displayName;
                groupChatParticipantList[i].save();
              }
            }
          } catch(err) {
            console.log('[DEBUG] Error while updating user displayname in Group Chat Participants Model.', err);
          }

          try {
            console.log("[DEBUG] Updating user displayname in Chat Messages Model.", oldUser.displayName, "-->", user.displayName);
            let chatMessages = await ChatMessage.find({senderId: user.id, status: 'V', chatType: 'G'});
            for (let i = 0; i < chatMessages.length; i++) {
              chatMessages[i].senderDisplayName = user.displayName;
              chatMessages[i].save();
            }
          } catch(err) {
            console.log('[DEBUG] Error while updating user displayname in Chat Messages Model.', err);
          }
        }
      } else {
        return res.status(401).send({status: "error", msg: "User not found"});
      }
    } catch(err) {
      //console.log(err);
      return res.status(401).send({status: "error", msg: "Invalid Token"});
    }
  } else  {
    try {
      const decoded = jwt.verify(token, config.TOKEN_KEY);
      req.user = decoded;
    } catch (err) {
      return res.status(401).send({status: "error", msg: "Invalid Token"});
    }
  }
  
  return next();
};

module.exports = verifyToken;