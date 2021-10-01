var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');

const { 
  v4: uuidv4,
} = require('uuid');
var db = require('../db/adapter/mongo');
var { User } = require('../db/model/models');

/* GET users listing. */
router.get('/test', function(req, res, next) {
  res.status(200).send("hello");
});

router.post("/register", async (req, res) => {

  // Our register logic starts here
  try {
    // Get user input
    const { displayName, username, password, role } = req.body;

    // Validate user input
    if (!(displayName && password && username && role)) {
      res.status(400).send({status: 'error', msg: 'Missing one or many required inputs'});
    }

    if (role === 'ADMIN') {
      res.status(400).send({status: 'error', msg: 'Self Registration for Admin is not allowed'});
    }

    if (role !== 'VISITOR' && role !== 'EXHIBITOR') {
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

    // Create token
    const token = jwt.sign(
      { id: user.id, role, username, displayName },
      process.env.TOKEN_KEY,
      {
        expiresIn: "24h",
      }
    );
    // save user token
    user.token = token;

    // return new user
    res.status(201).json(user);
  } catch (err) {
    console.log(err);
  }
  // Our register logic ends here
});


router.post("/login", async (req, res) => {

  // Our login logic starts here
  try {
    // Get user input
    const { username, password } = req.body;

    // Validate user input
    if (!(username && password)) {
      res.status(400).send("All input is required");
    }
    // Validate if user exist in our database
    const user = await User.findOne({ username: username, status: 'V' });

    if (user && (await bcrypt.compare(password, user.password))) {
      // Create token
      const token = jwt.sign(
        { id: user.id, role: user.role, displayName: user.displayName, username },
        process.env.TOKEN_KEY,
        {
          expiresIn: "24h",
        }
      );

      // save user token
      user.token = token;

      // user
      res.status(200).json(user);
    } else {
      res.status(400).json({status: 'error', msg: 'Invalid Credentials'});
    }
  } catch (err) {
    console.log(err);
  }
  // Our register logic ends here
});

module.exports = router;
