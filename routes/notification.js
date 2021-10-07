var express = require('express');
var router = express.Router();
const { 
  v4: uuidv4,
} = require('uuid');
const auth = require("../middleware/auth");
var { Notification } = require('../db/model/models');
var sio = require('../socket.io/socket');


router.get('/', auth, async function(req, res, next) {
  const requesterId = req.user.id;
  const notificationList = await Notification.find({ "userId": requesterId, status: 'V' }).sort({"createDate": "desc"});
  return res.status(200).json({status: 'success', data: notificationList});
});

module.exports = router;
