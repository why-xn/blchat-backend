var express = require('express');
var router = express.Router();
const { 
  v4: uuidv4,
} = require('uuid');
const auth = require("../middleware/auth");
var { ChatMessage, GroupChat, PrivateChat } = require('../db/model/models');


/* GET Chat Messages */
router.get('/:chatType/:chatId', auth, async (req, res, next) => {
  const { role } = req.user;
  const chatType = req.params.chatType.toUpperCase();
  const chatId = req.params.chatId;
  if (role !== 'ADMIN') {
      if (chatType == 'GROUP') {
        const groupChat = await GroupChat.findOne({ _id: chatId });
        if (groupChat == null || groupChat == undefined) {
          return res.status(400).json({status: 'error', msg: 'Not Found'});
        }
        if (groupChat.mode == 'PRIVATE') {
          return res.status(400).json({status: 'warning', msg: 'Private Group Chat is disabled for now'});
        }
      } else {
        const privateChat = await PrivateChat.findOne({_id: chatId});
        if (privateChat == null || privateChat == undefined) {
          return res.status(400).json({status: 'error', msg: 'Not Found'});
        }
        if (privateChat.participants[0] != req.user.userId && privateChat.participants[1] != req.user.userId) {
          return res.status(400).json({status: 'error', msg: 'Permission Denied'});
        }
      }
  }

  var chatMessages = await ChatMessage.find({chatId: chatId, status: 'V'}).sort({createDate: 'asc'}).limit(100);
  return res.status(200).json({status: 'success', data: chatMessages});
});

module.exports = router;
