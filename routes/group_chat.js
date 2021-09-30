var express = require('express');
var router = express.Router();
const { 
  v4: uuidv4,
} = require('uuid');
const auth = require("../middleware/auth");
var { GroupChat } = require('../db/model/models');

/* GET GroupChat listing. */
router.get('/public', auth, async (req, res, next) => {
  var publicGroupChats = await GroupChat.find({mode: 'PUBLIC', status: 'V'});
  return res.status(200).json({status: 'success', data: publicGroupChats});
});


/* Create new Public GroupChat */
router.post('/public', auth, async function(req, res, next) {
  const { role } = req.user;
  if (role !== 'ADMIN') {
    return res.sendStatus(403);
  }
  const { name, displayPicture } = req.body;

  const existingGroupChat = await GroupChat.findOne({ name: name });
  if (existingGroupChat) {
    return res.status(409).json({status: 'warning', msg: 'A Public Group Chat already exists with the same name.'})
  }

  const newGroup = new GroupChat({
    id: 'gc-' + uuidv4(),
    name: name,
    displayPicture: displayPicture,
    mode: 'PUBLIC',
    status: 'V'
  });
  newGroup.save().then(() => {
    return res.status(200).json({status: 'success', msg: 'Public Group Chat Created'});
  }).
  catch(error => {
    console.log(error);
    return res.status(500).json({status: 'error', msg: 'Error occurred while creating Public Group Chat'});
  });
  
});

module.exports = router;
