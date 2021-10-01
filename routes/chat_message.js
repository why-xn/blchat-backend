var express = require('express');
var router = express.Router();
const { 
  v4: uuidv4,
} = require('uuid');
const auth = require("../middleware/auth");
var { ChatMessage, GroupChat, PrivateChat } = require('../db/model/models');

function getChatType(chatId) {
  return chatId.substring(0, 2) === 'pc' ? 'P' : 'G';
}

/* GET Chat Messages */
router.get('/:chatId', auth, async (req, res, next) => {
  const { role } = req.user;
  const chatId = req.params.chatId;
  const chatType = getChatType(chatId);

  if (role !== 'ADMIN') {
      if (chatType == 'G') {
        const groupChat = await GroupChat.findOne({ id: chatId, status: 'V' });
        if (groupChat == null || groupChat == undefined) {
          return res.status(400).json({status: 'error', msg: 'Not Found'});
        }
        if (groupChat.mode == 'PRIVATE') {
          return res.status(400).json({status: 'warning', msg: 'Private Group Chat is disabled for now'});
        }
      } else {
        const privateChat = await PrivateChat.findOne({id: chatId, status: 'V'});
        if (privateChat == null || privateChat == undefined) {
          return res.status(400).json({status: 'error', msg: 'Not Found'});
        }
        if (privateChat.participants[0].id != req.user.id && privateChat.participants[1].id != req.user.id) {
          return res.status(400).json({status: 'error', msg: 'Permission Denied'});
        }
      }
  }

  var chatMessages = await ChatMessage.find({chatId: chatId, status: 'V'}).sort({createDate: 'asc'}).limit(100);
  return res.status(200).json({status: 'success', data: chatMessages});
});

module.exports = router;
