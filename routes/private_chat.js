var express = require('express');
var router = express.Router();
const { 
  v4: uuidv4,
} = require('uuid');
const auth = require("../middleware/auth");
var { PrivateChat } = require('../db/model/models');


/* Request for Private Chat */
router.get('/get/:otherParticipantId', auth, async function(req, res, next) {
  const requesterId = req.user._id;
  const otherParticipantId = req.params.otherParticipantId;

  var otherParticipant = await User.findById(otherParticipantId);

  const participantsInStr_1 = requesterId + ',' + otherParticipantId;
  const participantsInStr_2 = otherParticipantId + ',' + requesterId;

  const existingPrivateChat = await PrivateChat.findOne({ $or:[ {'participantsInStr': participantsInStr_1}, {'participantsInStr': participantsInStr_2} ]});
  if (!existingPrivateChat) {
    if (req.user.role === 'EXHIBITOR' && otherParticipant === 'EXHIBITOR') {
      return res.status(400).json({status: 'error', message: 'Exhibitor to Exhibitor Chat is not allowed'});
    } else if (req.user.role === 'VISITOR' && otherParticipant === 'VISITOR') {
      return res.status(200).json({status: 'warning', message: 'You can request the user for private chat'});
    } else if (req.user.role === 'EXHIBITOR' && otherParticipant === 'VISITOR') {
      return res.status(400).json({status: 'error', message: 'Exhibitor cannot initiate chat with a Visitor'});
    }

    const newPrivateChat = new PrivateChat({
      _id: uuidv4(),
      participants: [requesterId, otherParticipantId],
      participantsInStr: participantsInStr_1,
      requesterBy: requesterId,
      type: 'V2E',
      state: 'APPROVED',
      status: 'V',
      createDate: new Date(),
      createdBy: requesterId
    });
    newPrivateChat.save().then(() => {
      return res.status(200).json({status: 'success', data: newPrivateChat});
    }).
    catch(error => {
      console.log(error);
      return res.status(500).json({status: 'error', message: 'Error occurred while creating Private Chat'});
    });
  } else {
    return res.status(200).json({status: 'success', data: newPrivateChat});
  }
});


router.post('/request/:otherParticipantId', auth, async function(req, res, next) {
  const requesterId = req.user._id;
  const otherParticipantId = req.params.otherParticipantId;

  var otherParticipant = await User.findById(otherParticipantId);
  if (req.user.role === otherParticipant.role && req.user.role === 'VISITOR') {
    // do nothing
  } else {
    return res.status(400).json({status: 'success', msg: 'Not allowed to send request for private chat'});
  }

  const participantsInStr_1 = requesterId + ',' + otherParticipantId;
  const participantsInStr_2 = otherParticipantId + ',' + requesterId;

  const existingPrivateChat = await PrivateChat.findOne({ $or:[ {'participantsInStr': participantsInStr_1}, {'participantsInStr': participantsInStr_2} ]});
  if (existingPrivateChat && existingPrivateChat.state === 'APPROVED') {
    return res.status(200).json({status: 'success', msg: 'Request already approved', data: existingPrivateChat});
  } else if(existingPrivateChat && existingPrivateChat.state === 'REQUESTED') {
    return res.status(200).json({status: 'success', msg: 'Already requested', data: existingPrivateChat});
  } else {
    const newPrivateChat = new PrivateChat({
      _id: uuidv4(),
      participants: [requesterId, otherParticipantId],
      participantsInStr: participantsInStr_1,
      requesterBy: requesterId,
      type: 'V2V',
      state: 'REQUESTED',
      status: 'V',
      createDate: new Date(),
      createdBy: requesterId
    });
    newPrivateChat.save().then(() => {
      return res.status(200).json({status: 'success', msg: 'Request sent', data: newPrivateChat});
    }).
    catch(error => {
      console.log(error);
      return res.status(500).json({status: 'error', msg: 'Error occurred while creating private chat request'});
    });
  }

});


router.post('/request/approve/:chatId', auth, async function(req, res, next) {
  const requesterId = req.user._id;
  const chatId = req.params.chatId;

  const existingPrivateChat = await PrivateChat.findOne({_id: chatId});
  if (!existingPrivateChat) {
    return res.status(400).json({status: 'error', msg: 'Private chat not found'});
  } else if (existingPrivateChat.participants[0] !== requesterId && existingPrivateChat.participants[1] !== requesterId) {
    return res.status(400).json({status: 'error', msg: 'Permission denied'});
  }

  if (existingPrivateChat && existingPrivateChat.state === 'APPROVED') {
    return res.status(200).json({status: 'success', msg: 'Request already approved', data: existingPrivateChat});
  } else {
    existingPrivateChat.state = 'APPROVED';
    existingPrivateChat.save().then(() => {
      //TODO: Send Notification to the receipient
      www.getSocketIO().to(publicGroupChatId).emit("msg-channel", {code: 'GROUP_CHAT_ANNOUNCEMENT', chatId: publicGroupChatId, msg: socket.user.displayName + ' just joined the room!', senderId: 'server', senderDisplayName: 'Server'});
      return res.status(200).json({status: 'success', msg: 'Request approved'});
    }).
    catch(error => {
      console.log(error);
      return res.status(500).json({status: 'error', msg: 'Error occurred while accepting private chat request'});
    });
  }
});

module.exports = router;
