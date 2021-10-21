var express = require('express');
var router = express.Router();
const { 
  v4: uuidv4,
} = require('uuid');
const auth = require("../middleware/auth");
var { PrivateChat, User } = require('../db/model/models');
var sio = require('../socket.io/socket');
var notification = require('../core/api/v1/notification');


router.get('/', auth, async function(req, res, next) {
  try {
    const requesterId = req.user.id;
    var privateChatType = req.query.type;
    var privateChatState = req.query.state;
    var dbQuery = {"participants.id": requesterId, status: 'V'};
    if (privateChatType != undefined && privateChatType != null && privateChatType.length > 0) {
      dbQuery.type = privateChatType;
    }
    if (privateChatState != undefined && privateChatState != null && privateChatState.length > 0) {
      dbQuery.state = privateChatState;
    }

    const privateChatList = await PrivateChat.find(dbQuery).sort({"lastMessage.date": "desc"});
    return res.status(200).json({status: 'success', data: privateChatList});
  } catch(err) {
    console.log(err);
    return res.status(500).json({status: 'error', msg: 'Internal server error'});
  }
  
});


router.get('/:chatId', auth, async function(req, res, next) {
  const requesterId = req.user.id;
  const chatId = req.params.chatId;
  const existingPrivateChat = await PrivateChat.findOne({ id: chatId, status: 'V' });
  if (!existingPrivateChat.participantsInStr.includes(requesterId)) {
    return res.status(400).json({status: 'error', msg: 'Permission Denied'});
  }
  return res.status(200).json({status: 'success', data: existingPrivateChat});

});


/* Request for Private Chat */
router.get('/with/:otherParticipantId', auth, async function(req, res, next) {
  const requesterId = req.user.id;
  const otherParticipantId = req.params.otherParticipantId;

  if (requesterId == otherParticipantId) {
    return res.status(400).json({status: 'error', msg: 'You cannot chat with yourself'});
  }

  var otherParticipant = await User.findOne({id: otherParticipantId, status: 'V'});

  const participantsInStr_1 = requesterId + ',' + otherParticipantId;
  const participantsInStr_2 = otherParticipantId + ',' + requesterId;

  const existingPrivateChat = await PrivateChat.findOne({ status: 'V', $or:[ {'participantsInStr': participantsInStr_1}, {'participantsInStr': participantsInStr_2} ]});
  if (!existingPrivateChat) {
    if (req.user.role === 'EXHIBITOR' && otherParticipant.role === 'EXHIBITOR') {
      return res.status(200).json({status: 'success', msg: 'You can request the user for private chat', data: {type: 'E2E', state: 'NONE', canRequest: true, otherParticipant: otherParticipant}});
    } else if (req.user.role === 'VISITOR' && otherParticipant.role === 'VISITOR') {
      return res.status(200).json({status: 'success', msg: 'You can request the user for private chat', data: {type: 'V2V', state: 'NONE', canRequest: true, otherParticipant: otherParticipant}});
    } else if (req.user.role === 'EXHIBITOR' && otherParticipant.role === 'VISITOR') {
      return res.status(400).json({status: 'error', msg: 'Exhibitor cannot initiate chat with a Visitor'});
    } else if (req.user.role === 'HELP_DESK' && otherParticipant.role === 'HELP_DESK') {
      return res.status(200).json({status: 'success', msg: 'Help Desk to Help Desk chat is not allowed', data: {type: 'H2H', state: 'NONE', canRequest: false, otherParticipant: otherParticipant}});
    } else if (req.user.role === 'HELP_DESK' && otherParticipant.role === 'VISITOR') {
      return res.status(400).json({status: 'error', msg: 'Help Desk User cannot initiate chat with a Visitor'});
    } else if (req.user.role === 'HELP_DESK' && otherParticipant.role === 'EXHIBITOR') {
      return res.status(400).json({status: 'error', msg: 'Help Desk User cannot initiate chat with an Exhibitor'});
    }

    var privateChatType = 'V2E';
    if (req.user.role === 'VISITOR' && otherParticipant.role === 'HELP_DESK') {
      privateChatType = 'V2H';
    } else if (req.user.role === 'EXHIBITOR' && otherParticipant.role === 'HELP_DESK') {
      privateChatType = 'E2H';
    }

    const newPrivateChat = new PrivateChat({
      id: 'pc-' + uuidv4(),
      participants: [
        {
          id: requesterId,
          displayName: req.user.displayName,
          role: req.user.role
        },
        {
          id: otherParticipant.id,
          displayName: otherParticipant.displayName,
          role: otherParticipant.role
        }
      ],
      participantsInStr: participantsInStr_1,
      requesterBy: requesterId,
      type: privateChatType,
      state: 'APPROVED',
      status: 'V',
      createDate: new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"}),
      createdBy: requesterId
    });
    newPrivateChat.save().then(() => {
      return res.status(200).json({status: 'success', data: newPrivateChat});
    }).
    catch(error => {
      console.log(error);
      return res.status(500).json({status: 'error', msg: 'Error occurred while creating Private Chat'});
    });
  } else {
    return res.status(200).json({status: 'success', data: existingPrivateChat});
  }
});


router.post('/request/:otherParticipantId', auth, async function(req, res, next) {
  const requesterId = req.user.id;
  const otherParticipantId = req.params.otherParticipantId;

  if (requesterId == otherParticipantId) {
    return res.status(400).json({status: 'error', msg: 'You cannot chat with yourself'});
  }

  var privateChatType = 'V2V';
  var otherParticipant = await User.findOne({id: otherParticipantId, status: 'V'});
  if (req.user.role === otherParticipant.role && req.user.role === 'VISITOR') {
    // do nothing
  } else if (req.user.role === otherParticipant.role && req.user.role === 'EXHIBITOR') {
    privateChatType = 'E2E';
  } else {
    return res.status(400).json({status: 'success', msg: 'Not allowed to send request for private chat'});
  }

  const participantsInStr_1 = requesterId + ',' + otherParticipantId;
  const participantsInStr_2 = otherParticipantId + ',' + requesterId;

  const existingPrivateChat = await PrivateChat.findOne({ status: 'V', $or:[ {'participantsInStr': participantsInStr_1}, {'participantsInStr': participantsInStr_2} ]});
  if (existingPrivateChat && existingPrivateChat.state === 'APPROVED') {
    return res.status(200).json({status: 'success', msg: 'Request already approved', data: existingPrivateChat});
  } else if(existingPrivateChat && existingPrivateChat.state === 'REQUESTED') {
    return res.status(200).json({status: 'success', msg: 'Already requested', data: existingPrivateChat});
  } else {
    const newPrivateChat = new PrivateChat({
      id: 'pc-' + uuidv4(),
      participants: [
        {
          id: requesterId,
          displayName: req.user.displayName,
          role: req.user.role
        },
        {
          id: otherParticipant.id,
          displayName: otherParticipant.displayName,
          role: otherParticipant.role
        }
      ],
      participantsInStr: participantsInStr_1,
      requestedBy: requesterId,
      type: privateChatType,
      state: 'REQUESTED',
      status: 'V',
      createDate: new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"}),
      createdBy: requesterId
    });
    newPrivateChat.save().then(() => {
      //broadcasting to recipient for the notification
      notification.create('NOTIFICATION_NEW_PRIVATE_CHAT_REQUEST', {userId: otherParticipant.id, chatId: newPrivateChat.id, msg: req.user.displayName + ' has sent you a request for private chat'});

      return res.status(200).json({status: 'success', msg: 'Request sent', data: newPrivateChat});
    }).
    catch(error => {
      console.log(error);
      return res.status(500).json({status: 'error', msg: 'Error occurred while creating private chat request'});
    });
  }

});


router.post('/request/approve/:chatId', auth, async function(req, res, next) {
  const requesterId = req.user.id;
  const chatId = req.params.chatId;

  const existingPrivateChat = await PrivateChat.findOne({id: chatId, status: 'V'});
  if (!existingPrivateChat) {
    return res.status(400).json({status: 'error', msg: 'Private chat not found'});
  } else if (existingPrivateChat.participants[0].id !== requesterId && existingPrivateChat.participants[1].id !== requesterId) {
    return res.status(400).json({status: 'error', msg: 'Permission denied'});
  }

  if (existingPrivateChat && existingPrivateChat.state === 'APPROVED') {
    return res.status(200).json({status: 'success', msg: 'Request already approved', data: existingPrivateChat});
  } else {
    existingPrivateChat.state = 'APPROVED';
    existingPrivateChat.save().then(() => {
      var otherParticipantId = existingPrivateChat.participants[0].id;
      if (otherParticipantId == requesterId) {
        otherParticipantId = existingPrivateChat.participants[1].id;
      }
      
      //broadcasting to recipient for the notification
      notification.create('NOTIFICATION_PRIVATE_CHAT_REQUEST_APPROVED', {userId: otherParticipantId, chatId: existingPrivateChat.id, msg: req.user.displayName + ' has accepted your request for private chat'});
      
      return res.status(200).json({status: 'success', msg: 'Request approved', data: existingPrivateChat});
    }).
    catch(error => {
      console.log(error);
      return res.status(500).json({status: 'error', msg: 'Error occurred while accepting private chat request'});
    });
  }
});

module.exports = router;
