const request = require('request');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./config.json'));

const Steam = require('steam');
const SteamUserPlus = require('./lib/steam-user-plus');
const Client = new Steam.SteamClient();
const User = new SteamUserPlus(Client);
var logOnDetails = {account_name:'', password:'', two_factor_code:''}

const express = require('express')
const app = express();
const bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
const port = config.server_port || 8080;



app.get('/', (req, res) => {
    if (Client._connection){
        stopIdle(idlingTimeouts);
        Client.disconnect();
        Client.emit('disconnected');
    }
    res.sendFile('./http/index.html', { root: __dirname });
});

app.post('/', (req, res) => {
    if (req.body.user && req.body.password){
        logOnDetails.account_name = req.body.user;
        logOnDetails.password = req.body.password;
        if (req.body.token)
            logOnDetails.two_factor_code = req.body.token;
        if (Client._connection){
            stopIdle(idlingTimeouts);
            Client.disconnect();
            Client.emit('disconnected');
        }
        // Connects to steam servers
        Client.connect();
        res.sendFile('./http/success.html', { root: __dirname });
    }else {
        res.sendFile('./http/fail.html', { root: __dirname });
    }
});
  
app.listen(port, (err) => {
    if (err)
        return console.log('something bad happened', err)
    console.log(`server is listening on ${port}, please, go to the home page and submit your credentials information.`)
});

var idlingTimeouts = [];

Client.on('connected',function(){
    User.logOn(logOnDetails);
});


User.on('webLogOnResponse',function(){
    User.emit('debug',"Web Logged, calling badge list");

    User.badgeList({},function(list){
        User.emit('debug','The list of badges was successfully retrieved, '+list.length+' games to idle.');
        User.emit('debug','Starting Idle process');
        startIdle(list,{
            restart_after: config.idle.recache_time_mnts // minutes
        });
        
    });
});

function startIdle(gamesToIdle, args){
    if (args){
        if (args.restart_after && args.restart_after >= 5){
            User.emit('debug','Setting up restart strategy');
            var restartTime = args.restart_after*60*1000
            setTimeout(function(){
                User.emit('debug','It has been a long time since we last checked the badge list');
                User.emit('debug','Stopping current idle process');
                stopIdle(idlingTimeouts);
                User.badgeList({},function(list){
                    User.emit('debug','The list of badges was successfully retrieved, '+list.length+' games to idle.');
                    User.emit('debug','Restarting Idle process');
                    startIdle(list,args);
                })
            },restartTime);
        }
    }
    User.emit('debug','Starting new idle session');
    User.gamesPlayed([]);
    User.emit('debug','Waiting '+(config.idle.delay_time_ms/1000)+' seconds before starting to idle');
    idlingTimeouts.push(setTimeout(function(){
        var currentSession = getGamesToIdleNext(gamesToIdle) || [];
        if (currentSession.length > 0){
            var gameIds = [];
            User.emit('debug','Going to idle '+currentSession.length+' game(s) in this session.');
            for (var i = 0 ; i < currentSession.length ; i++){
                User.emit('debug',' Game: '+currentSession[i].game_title);
                gameIds.push({game_id: currentSession[i].game_id})
            }
            User.gamesPlayed(gameIds);
            idlingTimeouts.push(setTimeout(function(){
                User.emit('debug',(config.idle.session_time_ms/1000/60) + ' minutes have passed, updating hours played');
                for (var i = 0 ; i < currentSession.length ; i++){
                    for (var j = 0 ; j < gamesToIdle.length ; j++){
                        if (currentSession[i].game_id == gamesToIdle[j].game_id){
                            var playedFor = config.idle.session_time_ms;
                            playedFor/=1000/60/60;
                            gamesToIdle[j].hours_played+=playedFor;
                            break;
                        }
                    }
                }
                startIdle(gamesToIdle);
            },config.idle.session_time_ms));
        }else {
            User.emit('debug','List of games to idle has finished, disconnecting client.')
            stopIdle(idlingTimeouts);
            Client.disconnect();
            Client.emit('disconnected');
            //TODO: fix this so it checks if there's new games to idle from time to time
        }
    },config.idle.delay_time_ms));
}

function stopIdle(idlingTimeouts){
    while (idlingTimeouts.length > 0) {
        try {
            clearTimeout(idlingTimeouts.shift());
        }catch (e) {
            //
        }
    }
}

function getGamesToIdleNext(gamesToIdle){
    var returnList = [];
    for (var i = 0,j = 0; i < 10 && j < gamesToIdle.length;j++){
        if (gamesToIdle[j].hours_played < 2) {
            returnList.push(gamesToIdle[j]);
            i++;
        }
    }
    if (returnList.length == 0){
        returnList.push(gamesToIdle.shift());
        gamesToIdle.push(returnList);
    }
    return returnList;
}


// Misc handlers
User.on('error',function(reason){
    console.log('Error');
    console.log(reason)
});
User.on('debug',function(msg){
    console.log('[INFO][User]\t'+(new Date().toUTCString())+' - '+msg);
});
Client.on('debug',function(msg){
    console.log('[INFO][Client]\t'+(new Date().toUTCString())+' - '+msg);
});

Client.on('disconnected',function(){
    Client.emit('debug','Client disconnected.');
});
Client.on('error',function(){
    console.log('There was an error with the client, disconnected. Waiting some time and retrying');
    stopIdle(idlingTimeouts);
    setTimeout(function(){
        Client.connect();
    }, 60000);
})