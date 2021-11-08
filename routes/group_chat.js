var express = require('express');
var router = express.Router();
const { 
  v4: uuidv4,
} = require('uuid');
const auth = require("../middleware/auth");
var { GroupChat, GroupChatParticipant, PrivateChat } = require('../db/model/models');

/* GET GroupChat listing. */
router.get('/public', auth, async (req, res, next) => {
  const { role } = req.user;
  if (role !== 'ADMIN') {
    var publicGroupChats = await GroupChat.find({mode: 'PUBLIC', status: 'V', allowedRoles: role});
  } else {
    var publicGroupChats = await GroupChat.find({mode: 'PUBLIC', status: 'V'});
  }
  return res.status(200).json({status: 'success', data: publicGroupChats});
});


/* GET GroupChat Participants List. */
router.get('/public/:chatId/participants', auth, async function(req, res, next) {
  const { role } = req.user;
  const chatId = req.params.chatId;

  const existingGroupChat = await GroupChat.findOne({ id: chatId, status: 'V' });
  if (!existingGroupChat) {
    return res.status(404).json({status: 'error', msg: 'Group chat not found'});
  } else if (!existingGroupChat.allowedRoles.includes(role)) {
    return res.status(409).json({status: 'error', msg: 'Permission denied'});
  }

  let query = { chatId: chatId, status: 'V', "participant.id": { $ne: req.user.id }, "participant.activeConnections": { $gte: 0} };

  let searchText = req.query.search;
  if (searchText && searchText.length >= 3) {
    query["participant.displayName"] = { "$regex": searchText, "$options": "i" };
  }
  const participantList = await GroupChatParticipant.find(query).sort({"participant.displayName": "asc"}).limit(100);;
  
  // filtering out my friends out of group chat participants list
  const privateChatList = await PrivateChat.find({status: 'V', "participants.id": req.user.id, type: "V2V", state: { $ne: "REJECTED" }}).sort({"lastMessage.date": "desc"});
  let friendList = [];
  privateChatList.forEach((pc) => {
    if (pc.participants[0].id === req.user.id) {
      friendList[pc.participants[1].id] = 1;
    } else {
      friendList[pc.participants[0].id] = 1;
    }
  });

  let filterredParticipantList = [];
  for (let i = 0; i < participantList.length; i++) {
    try {
      if (friendList[participantList[i].participant.id] !== 1) {
        filterredParticipantList.push(participantList[i]);
      }
    } catch(err) {
      console.log(err);
      continue;
    }
  }
  return res.status(200).json({status: 'success', data: filterredParticipantList});
});


/* Create new Public GroupChat */
router.post('/public', auth, async function(req, res, next) {
  const { role } = req.user;
  if (role !== 'ADMIN') {
    return res.status(403).json({status: 'error', msg: 'Permission Denied'});
  }
  const { name, displayPicture, allowedRoles } = req.body;

  const existingGroupChat = await GroupChat.findOne({ name: name, allowedRoles: allowedRoles[0], status: 'V' });
  if (existingGroupChat) {
    return res.status(400).json({status: 'warning', msg: 'A Public Group Chat already exists with the same name.'})
  }

  const newGroup = new GroupChat({
    id: 'gc-' + uuidv4(),
    name: name,
    displayPicture: displayPicture,
    mode: 'PUBLIC',
    allowedRoles: allowedRoles,
    status: 'V',
    createDate: new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"})
  });
  newGroup.save().then(() => {
    return res.status(200).json({status: 'success', msg: 'Public Group Chat Created'});
  }).
  catch(error => {
    console.log(error);
    return res.status(500).json({status: 'error', msg: 'Error occurred while creating Public Group Chat'});
  });
  
});

router.delete('/:id', auth, async function(req, res, next) {
  const { role } = req.user;
  if (role !== 'ADMIN') {
    return res.status(403).json({status: 'error', msg: 'Permission Denied'});
  }
  const groupChatId = req.params.id;

  const groupChat = await GroupChat.findOne({ id: groupChatId, status: 'V' });
  if (groupChat) {
    groupChat.status = 'D';
    groupChat.save().then(() => {
      return res.status(200).json({status: 'success', msg: 'Public Group Chat Deleted'});
    }).
    catch(error => {
      console.log(error);
      return res.status(500).json({status: 'error', msg: 'Error occurred while deleting Public Group Chat'});
    });
  } else {
    return res.status(400).json({status: 'error', msg: 'Not found'});
  }
});

module.exports = router;
