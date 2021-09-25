var express = require('express');
var router = express.Router();
const { 
  v4: uuidv4,
} = require('uuid');
const auth = require("../middleware/auth");
var db = require('../db/adapter/mongo');
var { User } = require('../db/model/models');

/* GET users listing. */
router.get('/', auth, async (req, res, next) => {
  const { role } = req.user;
  
  const queryRole = req.query.role.toUpperCase();
  if (role !== 'ADMIN' && queryRole == 'ADMIN') {
    return res.sendStatus(403);
  }

  if (queryRole !== undefined && queryRole !== null && queryRole.length > 0) {
    var users = await User.find({role: queryRole});
  } else if (role !== 'ADMIN') {
    var users = await User.find({ role: { $ne: 'ADMIN' } });
  } else {
    var users = await User.find();
  }
  
  res.status(200).json({data: users});
});




/* GET MySelf */
router.get('/myself', auth, async (req, res, next) => {
  var user = await User.findById(req.user.userId);
  res.status(200).json({status: 'success', data: user});
});



router.get("/welcome", auth, (req, res) => {
  res.status(200).send("Welcome 🙌 ");
});



router.get('/test', function(req, res, next) {
  const shihab = new User({
    _id: uuidv4(),
    displayName: 'Shihab Hasan',
    username: 'whyxn',
    password: 'hello123',
    activeConnections: 0
  })
  shihab.save().then(() => console.log('new user added'));
  res.send('New user added');
});

router.get('/dbtest', function(req, res, next) {
  db.test();
  res.send('DB Test Successful');
});

module.exports = router;
