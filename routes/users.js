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
    res.status(403).json({status: 'error', msg: 'Query not allowed'});
  }

  if (queryRole !== undefined && queryRole !== null && queryRole.length > 0) {
    var users = await User.find({role: queryRole, id: { $ne: req.user.id }, status: 'V'});
  } else if (role !== 'ADMIN') {
    var users = await User.find({ role: { $ne: 'ADMIN' }, id: { $ne: req.user.id }, status: 'V' });
  } else {
    var users = await User.find({ id: { $ne: req.user.id }, status: 'V'});
  }
  
  res.status(200).json({status: 'success', data: users});
});


// create new user by admin
router.post("/", auth, async (req, res) => {
  const { role } = req.user;
  if (role !== 'ADMIN') {
    res.status(403).json({status: 'error', msg: 'Permission denied'});
  }

  try {
    // Get user input
    const { displayName, username, password, role } = req.body;

    // Validate user input
    if (!(displayName && password && username && role)) {
      res.status(400).send({status: 'error', msg: 'Missing one or many required inputs'});
    }

    if (role !== 'VISITOR' && role !== 'EXHIBITOR' && role !== 'ADMIN' && role !== 'HELP_DESK') {
      res.status(400).send({status: 'error', msg: 'Invalid role'});
    }

    // check if user already exist
    // Validate if user exist in our database
    const oldUser = await User.findOne({ username: username, status: 'V'});

    if (oldUser) {
      return res.status(409).json({status: 'warning', msg: 'User already exists. Please login.'})
    }

    //Encrypt user password
    encryptedPassword = await bcrypt.hash(password, 10);

    // Create user in our database
    const user = await User.create({
      id: uuidv4(),
      displayName: displayName,
      username: username,
      password: encryptedPassword,
      role: role,
      status: 'V',
      createDate: new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"})
    });

    // return new user
    res.status(201).json({status: 'success', data: user});
  } catch (err) {
    console.log(err);
    res.status(500).json({status: 'error', msg: 'Error occurred while processing request'});
  }
  
});



/* GET MySelf */
router.get('/myself', auth, async (req, res, next) => {
  var user = await User.findOne({id: req.user.id, status: 'V'});
  res.status(200).json({status: 'success', data: user});
});



router.get("/welcome", auth, (req, res) => {
  res.status(200).send("Welcome 🙌 ");
});



/*router.get('/test', function(req, res, next) {
  const shihab = new User({
    id: uuidv4(),
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
});*/

module.exports = router;
