require('dotenv').config()
const bodyParser = require('body-parser');
const express = require('express')
const app = express()
const cors = require('cors')
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  log: { type: Array, default: []}
});
const User = mongoose.model('User', userSchema);

app.use(cors())
app.use(express.static('public'))
app.use(bodyParser.urlencoded({extended: false}));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// Request logger:
app.use(function(req, res, next) {
  console.log(req.method + " " + req.path + " - " + req.ip);
  next();
})

const isValidDate = async (date) => {
  if(await Object.prototype.toString.call(date) === "[object Date]") {
    return !isNaN(date.getTime());
  } else {
    return "not a date";
  }
}

const clearDatabase = async () => {
  try {
    const result = await User.deleteMany({});
    console.log("Deleted " + result.deletedCount + " entries.");

    return result.deletedCount;
  }
  catch(error) {
    console.log(error.message);
  }
}

const findAllInDB = async () => {
  try {
    const query = await User.find({}, 'username _id');
    console.log(query);
    return query;
  }
  catch(error) {
    console.log(error.message);
  }
}

const findInDB = async (queryObject) => {
  try {
    const query = await User.findOne(queryObject);
    console.log(query);
    return query;
  } catch(error) {
    console.log(error.message);
  }
}

const createUserInDB = async (username) => {
  try {
    const newUser = await User.create({
      username
    });
    findInDB({_id: newUser._id});
    return newUser;
  }
  catch(error) {
    console.log(error.message);
  }
}

const addLogEntryToUser = async (id, description, duration, date) => {
  try {
    const user = await findInDB({_id: id});
    user.log.push({
      description,
      duration,
      date
    });
    user.save();
    console.log("New log entry:");
    console.log({ description, duration, date });
    return user;
  }
  catch(error) {
    console.log(error.message);
  }
}

const filterLogResults = async (logArray, fromDate, toDate, limitResults) => {
  try {
    fromDate = new Date(fromDate);
    toDate = new Date(toDate);

    if (fromDate && toDate) {
      if (fromDate > toDate) {
        console.log("In 'filterLogResults': 'from' date is greater than 'to' date.");
        return null;
      }
    }
    if (!limitResults) {
      limitResults = logArray.length;
    }

    const filteredArray = [];
    const length = logArray.length;
    let count = 0;

    for (let i = 0; i < length; i++) {
      if (count == limitResults) {
        break;
      }
      let fromCheck = true;
      if (fromDate && (new Date(logArray[i].date) < fromDate)) {
        fromCheck = false;
      }
      let toCheck = true;
      if (toDate && (new Date(logArray[i].date) > toDate)) {
        toCheck = false;
      }
      if (fromCheck && toCheck) {
        filteredArray.push(logArray[i]);
        count++;
      }
    }
    console.log(filteredArray);
    return filteredArray;
  }
  catch(error) {
    console.log(error.message);
  }
}

// Clear database.
app.get("/api/clear", async function (req, res) {
  const deletedCount = await clearDatabase();

  res.json("Database cleared with " + deletedCount + " entries deleted.");
});

// Get list of all users.
app.get("/api/users", async function (req, res) {
  const userList = await findAllInDB();

  res.json(userList);
});

// Get list of all exercise logs of a user.
app.get("/api/users/:_id/logs", async function (req, res) {
  const id = await req.params._id;
  const fromDate = await req.query.from;
  const toDate = await req.query.to;
  const limitResults = await req.query.limit;
  const user = await findInDB({_id: id});
  
  console.log("fromDate: " + fromDate);
  console.log("toDate: " + toDate);
  console.log("limitResults: " + limitResults);

  const logResults = await filterLogResults(user.log, fromDate, toDate, limitResults);

  res.json({
    username: user.username,
    count: logResults.length,
    _id: user._id,
    log: logResults
  });
});

// Create new user.
app.post("/api/users", async function (req, res) {
  const username = req.body.username;
  const newUser = await createUserInDB(username);

  res.json({ username: username, _id: newUser._id });
});

// Add exercise data to user log.
app.post("/api/users/:_id/exercises", async function (req, res) {
  const id = await req.params._id;
  const description = await req.body.description;
  const duration = Number.parseInt(await req.body.duration);

  // Handling date.
  let date = new Date(await req.body.date);
  const dateOK = await isValidDate(date);
  if(!dateOK) date = new Date();

  const user = await addLogEntryToUser(id, description, duration, date.toDateString());

  res.json({
    username: user.username,
    description,
    duration,
    date: date.toDateString(),
    _id: user._id
    });
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
