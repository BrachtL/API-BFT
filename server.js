//my db in freemysqlhosting is late by about 3 minutes, but I can't fix it
//for this application, the best is to save in the db the time "wrong" (with this late) because I consult the last 24h
//if I save it with a correctness, I will consult it wrong afterwards
//since I will be saving it "wrong" in the db, I have to check the current time in db here and calculate the time difference,
//then I apply the correctness and send it corrected to android 

//todo: APPLY 2m50s of correctness!

//todo: trocar os parâmetros invés de json no body para query params. Assim posso trocar alguns POST para GET, sendo mais semântico.


const express = require("express");
const mysql = require('mysql2/promise');
const app = express();

app.listen(3000);
console.log("successful loaded :D");

// Function to handle unexpected errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

// Function to handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});

//middleware (ponte entre requests)
app.use(express.json()); //possibilita executar json

//check if server is online
app.route("/").get((requirement, response) => {
  response.send("The server is online");
});

// Create a MySQL database connection pool
const pool = mysql.createPool({
  host: 'sql10.freemysqlhosting.net',
  user: 'sql10611177',
  password: 'CCArxAhbqc',
  database: 'sql10611177',
  connectionLimit: 10,
  idleTimeout: 270000 // set the idle timeout to 3 minutes
});

async function getCurrentDbTime() {
  try {
    const connection = await pool.getConnection();

    const [rows, fields] = await connection.query('SELECT TIME(NOW())');
    
    connection.release();
    
    const currentDbTime = rows;
    console.log(`Current time is:`, currentDbTime);
    return currentDbTime;
  }
  catch(error) {
    console.log("Error getting database time:", error);
  }
}

var currentDbTime = getCurrentDbTime();
//is it always 2m50s?

//POST

//Check if station and user are available

async function getStationNames() {
  try {
    const connection = await pool.getConnection();
    
    const [results, fields] = await connection.query(`SELECT DISTINCT station FROM station`);

    connection.release();
    
    console.log(`getStationNames() return: `, results);
    return results;
  } 
  catch(error) {
    console.log("Error querying the database:", error);
    throw new Error("Internal server error");
  }
}

async function getUsernamesInStation(station) {
  try {
    const connection = await pool.getConnection();
    
    const [results, fields] = await connection.query(`SELECT username FROM station WHERE station = '${station}'`);

    connection.release();
    
    console.log(`getUsernamesInStation(${station}) return: `, results);
    return results;
  } 
  catch(error) {
    console.log("Error querying the database:", error);
    throw new Error("Internal server error");
  }
}

async function setStation(data) {
  try {
    const connection = await pool.getConnection();
    
    const [results, fields] = await connection.query(`INSERT INTO station (username, color, station) VALUES ('${data.username}', '${data.userColorClient}', '${data.station}')`);
    
    connection.release();
    
    console.log(`setStation(${data}) return: `, "successful");
    return "successful";
   }
    catch(error) {
    console.log("Error querying the database:", error);
    throw new Error("Internal server error");
  }
}

app.route("/station/checkAvailabilityAndPost").post(async (req, res) => {

  const usernameClient = req.body.username;
  const stationClient = req.body.station;
  const userColorClient = req.body.userColor; 
  
  try {
    const stationNamesDb = await getStationNames();
    
    const isStationClientNameUsed = stationNamesDb.find(obj => obj.station == stationClient);
    
    //todo: owner and pending row in db, activity aproval in android for the owner when someone is pending, show pendeing in LoginActivity
    if(isStationClientNameUsed) {
      const usernamesDb = await getUsernamesInStation(stationClient);
      const isUsernameClientUsed = usernamesDb.find(obj => obj.username == usernameClient)
      
      if(isUsernameClientUsed) {
        //case1: user is used in an existed station
        var responseJSON = {
            message: "userAlreadyInTheStation"
          }
        console.log("post /checkAvailability response: ", responseJSON);
        res.json(responseJSON);
      } else { 
        await setStation(req.body);
        //case2: user is available in an existed station (user pending todo: to implement)
        var responseJSON = {
          message: "userIsNowPending"
        }
        console.log("post /checkAvailability response: ", responseJSON);
        res.json(responseJSON);
      } 
      
    } else {
      //case3: user is available in an new station (user owner todo: to implement)
      await setStation(req.body);
      var responseJSON = {
        message: "userIsNowOwner"
      }
      console.log("post /checkAvailability response: ", responseJSON);
      res.json(responseJSON);
    }    
    console.log("Something went really bad in the /checkAvailability post");
  }
  catch (error) {
    console.log('Error retrieving high scores:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }

});

//mamada

async function getMamadas(data, n) {
  try {
    const connection = await pool.getConnection();
    
    //querying the db already applying the plus 2m50s correctness      
    const [mamadas, fields] = await connection.query(`SELECT username, station, DATE_ADD(datetime, INTERVAL '2:50' MINUTE_SECOND) AS datetime, amount FROM mamada WHERE station = '${data.station}' ORDER BY datetime DESC LIMIT ${n}`);

    connection.release();
    
    console.log(`getMamadas(${n}) return: `, mamadas);
    return mamadas;
   }
  catch(error) {
    console.log("Error querying the database:", error);
    throw new Error("Internal server error");
  }
}

//return an array of unique usernames: users that fed in the last mamadas to show on the history screen
async function getDistinctUsernames(mamadasJSON) {
  try {
    const uniqueUsers = mamadasJSON.reduce((acc, { username }) => {
      if (!acc.includes(username)) {
        acc.push(username);
      }
      return acc;
    }, []);
       
    console.log("getDistinctUsernames(", mamadasJSON, ") return: ", uniqueUsers);
    return uniqueUsers; //array, not json
    
  }
  catch(error) {
    console.log("Error getting distinct users:", error);
    throw new Error("Internal server error");
  }
}

async function getUsersColors(usersArray, station) {
  try {
    const connection = await pool.getConnection();
    var colorsArray = [];
    
    let k;
    for(k = 0; k < usersArray.length; k++) {
      var [color, fields] = await connection.query(`SELECT color FROM station WHERE username = '${usersArray[k]}' AND station = '${station}'`);       
      colorsArray[k] = color[0].color;
    }
    
    connection.release();

    console.log(`getUsersColors(`, usersArray, `, ${station}) return: `, colorsArray);
    return colorsArray;
  }
  catch(error) {
    console.log("Error querying the database:", error);
    throw new Error("Internal server error");
  }
}

async function getAndCalculateAverages(data) {

  try {
    const connection = await pool.getConnection();
    
    const [amounts06, fields06] = await connection.query(`SELECT amount FROM mamada WHERE station = '${data.station}' AND datetime >= DATE_SUB(NOW(), INTERVAL 6 HOUR)`);   
    const [amounts12, fields12] = await connection.query(`SELECT amount FROM mamada WHERE station = '${data.station}' AND datetime >= DATE_SUB(NOW(), INTERVAL 12 HOUR)`);
    const [amounts24, fields24] = await connection.query(`SELECT amount FROM mamada WHERE station = '${data.station}' AND datetime >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`);
    const [amountsAndTimeAll, fieldsAllTime] = await connection.query(`SELECT amount, datetime FROM mamada WHERE station = '${data.station}' ORDER BY datetime DESC`);

    connection.release();
    
    async function calculateAverage(amounts, hours) {
      let sum = 0;
      
      for(let k = 0; k < amounts.length; k++) {
        sum += amounts[k].amount;
      }
      
      let average = (sum/hours).toFixed(2);
      
      return average;
    } 
    
    async function calculateAverageAllTime(amounts) {
      let sum = 0;
      const firstDatetime = new Date(amounts[amounts.length-1].datetime);
      const lastDatetime = new Date(amounts[0].datetime);
      
      const timeDiff = Math.abs(lastDatetime - firstDatetime);
      const hoursDiff = ((timeDiff / 1000) / 60) / 60;
      
      for(let k = 0; k < amounts.length; k++) {
        sum += amounts[k].amount;
      }
    
      console.log(hoursDiff);      
      console.log(sum/hoursDiff);
      
      const averageAllTime = (sum/hoursDiff).toFixed(2);
      
      return averageAllTime;
    }
        
    const averagesObject = {
      average06: await calculateAverage(amounts06, 6),
      average12: await calculateAverage(amounts12, 12),
      average24: await calculateAverage(amounts24, 24),
      averageAllTime: await calculateAverageAllTime(amountsAndTimeAll)
    }
    
    console.log(`getAndCalculateAverages(`, data, `) return: `, averagesObject);
    return averagesObject;
  }
  catch(error) {
    console.log("Error querying the database:", error);
    throw new Error("Internal server error");
  } 
}

async function makeScreenDataObject(lastMamadas, uniqueUsersArray, uniqueColorsArray, averagesObject) {
  var usernameArray = [];
  var stationArray = [];
  var timeArray = [];
  var amountArray = [];
  var colorArray = [];
  var hours = "";
  var minutes = "";
  
  for(let k = 0; k < lastMamadas.length; k++) {
    usernameArray[k] = lastMamadas[k].username;
    stationArray[k] = lastMamadas[k].station;
    hours = lastMamadas[k].datetime.getHours().toString().padStart(2, '0');
    minutes = lastMamadas[k].datetime.getMinutes().toString().padStart(2, '0');
    timeArray[k] = `${hours}:${minutes}`;
    amountArray[k] = lastMamadas[k].amount;
    
    for(let i = 0; i < uniqueUsersArray.length; i++) {
      if(lastMamadas[k].username == uniqueUsersArray[i]) {
        colorArray[k] = uniqueColorsArray[i];
        break;
      }
    }
  }
  
  const screenDataObject = {
    usernameArray: usernameArray,
    stationArray: stationArray,
    timeArray: timeArray,
    amountArray: amountArray,
    colorArray: colorArray,
    average06: averagesObject.average06,
    average12: averagesObject.average12,
    average24: averagesObject.average24,
    averageAllTime: averagesObject.averageAllTime
  }
  
  console.log(`makeScreenDataObject(lastMamadas, uniqueUsersArray, uniqueColorsArray, averagesObject) return `, screenDataObject);
  return screenDataObject;
}

app.route("/getMamadasScreenData").post(async (req, res) => {
  //the average is not consulted by the app, it is calculated at the time consulting the last 24h amounts.
  //the averages registered in db are for analisys purposes
  
  const usernameClient = req.body.username;
  const stationClient = req.body.station;
  const userColorClient = req.body.userColor; 
  
  try {
    const last6Mamadas = await getMamadas(req.body, 6); //object array: username, station, datetime ("2023-04-10T16:04:15.000Z"), amount
    const uniqueUsersArray = await getDistinctUsernames(last6Mamadas); //array: distinct usernames
    const uniqueColorsArray = await getUsersColors(uniqueUsersArray, req.body.station); //array: distinct colors
    const averagesObject = await getAndCalculateAverages(req.body); //object: average06, average12, average24, averageAllTime
    
    const screenDataObject = await makeScreenDataObject(last6Mamadas, uniqueUsersArray, uniqueColorsArray, averagesObject);        
    
    res.json(screenDataObject);    
    
  }
  catch(error) {
    console.log("Error querying the database:", error);
    throw new Error("Internal server error");
  }
});

//todo: post na rota "/mamada"
  //verifica a média antes de postar (para registrar no banco o valor das médias quando ela ficou com fome), pode ser pelo post na "/getMamadasScreenData", pelo menos por enquanto
  //client envia username, station, (color client pega do banco), time*, amount. As médias são calculadas na hora de postar, com os dados do db.
  
  //Fazer a primeira versão sem poder postar um tempo passado, somente no tempo atual
  //todo: *(se não editar o time, pega o time do banco + 2m50s, se editar aí tenho que ver como fazer. As médias terão que ser calculadas somente até aquele momento mencionado)
  //todo: pra ficar bem top, tem que recalcular todas as médias posteriores ao post da mamada com o tempo editado, pois interferiu né...

  //todo: get na rota "/pending": checa se está pendente ou é owner de station com pending users 


//daqui pra baixo apenas reciclei o código anterior, deletar

//get the score for a determined position
//return a json object
async function getScore(position) { 
  try {
    const connection = await pool.getConnection();
       
    var [scoreN, fields] = await connection.query(`SELECT score FROM scoreboard ORDER BY score DESC LIMIT 1 OFFSET ${position-1}`);
    
    connection.release();
    
    console.log(`getScore(${position}) return: `, scoreN[0]);
    return scoreN[0];
  
  }
  catch(error) {
    console.log("Error querying the database:", error);
    throw new Error("Internal server error");
  }
    
}

//get user's previous high score, date and its position, 0 means that they dont exists in db
//returns a json object with score, date and position when this high score exists or 0 when it does not exist
async function getUserHighScore(userId) {
  try {
    const connection = await pool.getConnection();
        
    var [resultsHighScoreAndDate, fields] = await connection.query(`SELECT score, date FROM scoreboard WHERE user_id = '${userId}'`);
    var [resultUserPosition, fields] = await connection.query(`SELECT COUNT(*) + 1 AS position FROM scoreboard WHERE score > (SELECT score FROM scoreboard WHERE user_id = '${userId}') ORDER BY score DESC`);
    
    var userPreviousHighScoreIndexAndDateObject = 0;
    if(resultsHighScoreAndDate.length > 0) {
      userPreviousHighScoreIndexAndDateObject = {
        score: resultsHighScoreAndDate[0].score,
        date: resultsHighScoreAndDate[0].date,
        position: resultUserPosition[0].position
      }
    }
    
    connection.release();
    
    console.log(`getUserHighScore(${userId}) return: `, userPreviousHighScoreIndexAndDateObject);
    return userPreviousHighScoreIndexAndDateObject;
  }
  catch(error) {
    console.log("Error querying the database:", error);
    throw new Error("Internal server error");
  }
}

async function setUserHighScore(data) {
  try {
    const connection = await pool.getConnection();
    
    //delete before set
    //this query consider user_id as primary key, if I let an user to register more than one score in scoreboad,
      //I will have to change it
    await connection.query(`DELETE FROM scoreboard WHERE user_id = '${data.userId}'`);
  
    //I am adding 3 minutes because the time in the machine server is 3 minutes late
    var [results, fields] = await connection.query(`INSERT INTO scoreboard (user_id, score, date) VALUES ('${data.userId}', '${data.score}',  DATE_ADD(NOW(), INTERVAL 3 MINUTE))`);
  
    var newHighScore = await getUserHighScore(data.userId);
    console.log(`setUserHighScore(${data}) return: `, newHighScore);
    return newHighScore;
   }
    catch(error) {
    console.log("Error querying the database:", error);
    throw new Error("Internal server error");
  }
}

app.route("/highscore").post(async (req, res) => {
  if (req.body.tempSignature != "42arkanoidisfun42") {
    res.status(401).send("Invalid access");
  } else {
    var scoreReceived = req.body;
    var lastScoreScoreboard = await getScore(10);
    
    try {
      
      var dbUserHighScore = await getUserHighScore(scoreReceived.userId);
      //console.log(dbUserHighScore);
          
      if(dbUserHighScore == 0) {
        var newHighScore = await setUserHighScore(scoreReceived);
                
        //case 1: user set up his first score, in the scoreboard
        if(newHighScore.score > lastScoreScoreboard.score) {
          var responseJSON = {
            message: "firstScoreInScoreboard",
            newPosition: newHighScore.position
          }
          
          console.log("finish POST score");
          res.json(responseJSON);     
        } 
        
        //case 2: user set up his first score, out of the scoreboard
        else {
          var responseJSON = {
            message: "firstScoreOutOfScoreboard",
            newPosition: newHighScore.position
          }
          
          console.log("finish POST score");
          res.json(responseJSON);     
        }
         
      } 
      
      else if(scoreReceived.score > dbUserHighScore.score) {
        
        //case 3: user beat its personal record, but did not enter to the scoreboard
        if(scoreReceived.score <= lastScoreScoreboard.score) {
        var newHighScore = await setUserHighScore(scoreReceived);
        
        var responseJSON = {
          message: "personalHighScore",
          dbScore: dbUserHighScore.score,
          dbDate: dbUserHighScore.date,
          dbPosition: dbUserHighScore.position,
          newPosition: newHighScore.position
        }
        
        console.log("finish POST score");
        res.json(responseJSON);
        }
        
        //case 4: user beat its personal record, and entered to the scoreboard    
        else if(scoreReceived.score > lastScoreScoreboard.score) {
          //console.log("estive aqui");
          var newHighScore = await setUserHighScore(scoreReceived);

          var responseJSON = {
            message: "socoreboardHighScore",
            dbScore: dbUserHighScore.score,
            dbDate: dbUserHighScore.date,
            dbPosition: dbUserHighScore.position,
            newPosition: newHighScore.position
          }

          console.log("finish POST score");
          res.json(responseJSON);
          }
      
      
      }
      
      //case 5: this user has a better score in the db
      else {
        var responseJSON = {
          message: "notHighScore",
          dbScore: dbUserHighScore.score,
          dbDate: dbUserHighScore.date,
          dbPosition: dbUserHighScore.position,
          //todo: query para saber qual a posição mais próxima do score feito
        }
        
        console.log("finish POST score");
        res.json(responseJSON);
      }

    }
    catch (error) {
      console.log('Error retrieving high scores:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
});
    
    
  

//QUERY FOR FURTHER USES

/*

INSERT INTO `mamada`(`username`, `datetime`, `amount`, `average_6`, `average_12`, `average_24`, `station`) VALUES ('teste1', NOW(), 120, 0, 0, 0, 'stationTeste1');

INSERT INTO `mamada`(`username`, `datetime`, `amount`, `average_6`, `average_12`, `average_24`, `station`) VALUES ('teste1', (DATE_SUB(NOW(), INTERVAL 1 HOUR)), 30, 0, 0, 0, 'stationTeste1');

INSERT INTO `mamada`(`username`, `datetime`, `amount`, `average_6`, `average_12`, `average_24`, `station`) VALUES ('teste1', (DATE_SUB(NOW(), INTERVAL 2 HOUR)), 60, 0, 0, 0, 'stationTeste1');

INSERT INTO `mamada`(`username`, `datetime`, `amount`, `average_6`, `average_12`, `average_24`, `station`) VALUES ('teste1', (DATE_SUB(NOW(), INTERVAL 23 HOUR)), 90, 0, 0, 0, 'stationTeste1');

INSERT INTO `mamada`(`username`, `datetime`, `amount`, `average_6`, `average_12`, `average_24`, `station`) VALUES ('teste1', (DATE_SUB(NOW(), INTERVAL 24 HOUR)), 120, 0, 0, 0, 'stationTeste1');

*/
