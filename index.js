const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./config.json'));
var currentReq = null, currentRes = null;

const Steam = require('steam');
const SteamUserPlus = require('steam-user-plus');
const Client = new Steam.SteamClient();
const EResult = Steam.EResult;
const User = new SteamUserPlus(Client);
var logOnDetails = {account_name:'', password:''}
const Idler = require('./lib/idler');
registerClientHandlers(Client);
registerUserHandlers(User);

// Web
const app = require('express')();
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
const port = config.server_port || 8080;


app.get('/login', (req, res) => {
    res.sendFile('index.html',{ root: __dirname+'/views' });
});
app.get('/fail', (req, res) => {
    res.sendFile('fail.html',{ root: __dirname+'/views' });
});
app.get('/success', (req, res) => {
    res.sendFile('success.html',{ root: __dirname+'/views' });
})

app.get('/', (req, res) => {
    if (Client._connection && Client.loggedOn){
        stopIdle(idlingTimeouts);
        Client.disconnect();
        Client.emit('disconnected');
    }
    res.redirect('/login');
});

app.post('/', (req, res) => {
    if (req.body.user && req.body.password){
        logOnDetails.account_name = req.body.user;
        logOnDetails.password = req.body.password;
        delete logOnDetails.two_factor_code
        if (req.body.token){
            if (User.loginType){
                if (User.loginType == 'two_factor')
                    logOnDetails.two_factor_code = req.body.token;
                else if (User.loginType == 'email')
                    logOnDetails.auth_code = req.body.token;
            }
        }
        if (Client._connection){
            stopIdle();
            Client.disconnect();
            Client.emit('disconnected');
        }
        // Connects to steam servers
        currentReq = req;
        currentRes = res;
        Client.connect();
        //res.sendFile('./http/success.html', { root: __dirname });
    }else {
        res.redirect('/fail', { root: __dirname });
    }
});
  
app.listen(port, (err) => {
    if (err)
        return console.log('something bad happened', err)
    console.log(`server is listening on ${port}, please, go to the home page and submit your credentials information.`)
});


var idlingProcess = null;
var recacheProcess = null;
function startIdle(gamesList, args){
    var idler = new Idler(User, gamesList);
    debug('Idler', idler);

    User.emit('debug','Starting new idle session');
    User.emit('debug','Session info:');
    User.emit('debug','  Games to idle: '+idler.remainingGames.length);
    User.emit('debug','  Idling restart time: '+config.idle.session_time_ms/1000/60+' minutes');
    if (args && args.recache_after) User.emit('debug','  Game list recache time: '+args.recache_after+' minutes');
    console.log(''); //Space on console.

    if (args && args.recache_after){
        recacheProcess = recacheAfter(idler, args.recache_after);
    }
    
    idlingProcess = startIdleHelper(idler);

    if (currentRes){
        currentRes.redirect('/success');
        currentRes = currentReq = null;
    }
}
function startIdleHelper(idler){
    if (idler.idle()){
        console.log(''); //Space on console.
        return setTimeout(function(){
            idler.shuffleRemaining();
            idlingProcess = startIdleHelper(idler);
        }, config.idle.session_time_ms);
    }
    return null;
}

function stopIdle(idler){
    if (idler) idler.stop();
    if (idlingProcess) clearTimeout(idlingProcess);
    if (recacheProcess) clearTimeout(recacheProcess);
}

function recacheAfter(idler, minutes){
    User.emit('debug','Setting up recache strategy.');
    console.log('');
    var milliseconds = minutes*60*1000;
    return setTimeout(function(){
        User.emit('debug','It has been a long time since we last checked the badge list, recaching...');
        getBadgeList({no_cache:true},function(list){
            User.emit('debug','The list of badges was successfully retrieved, '+list.length+' games in the list.');
            User.emit('debug','Updating idler');
            console.log('');
            idler.updateGamesLists(list);
            recacheProcess = recacheAfter(idler,minutes);
        });
    },milliseconds);
}

function registerClientHandlers(client){
    debug('Client',client);
    client.on('connected',function(){
        User.logOn(logOnDetails);
    });
    client.on('disconnected',function(){
        client.emit('debug','Client disconnected.');
    });
    client.on('error',function(){
        console.log('There was an error with the client, disconnected. Waiting some time and retrying');
        stopIdle(idlingTimeouts);
        setTimeout(function(){
            client.connect();
        }, 60000);
    });
}

function registerUserHandlers(user){
    debug('User',user);
    user.on('error',function(reason){
        console.log('Error');
        console.log(reason);
        if (currentRes){
            currentRes.redirect('/fail?reason='+reason);
            currentReq = null;
            currentRes = null;
        }
    });

    user.on('webLogOnResponse',function(){
        user.emit('debug',"Web Logged, calling badge list");
    
        getBadgeList({},function(list){
            user.emit('debug','The list of badges was successfully retrieved, '+list.length+' games in the list.');
            user.emit('debug','Starting Idle process');
            startIdle(list,{
                recache_after: config.idle.recache_time_mnts // minutes
            });
            
        });
    });
}

function debug(name,obj){
    obj.on('debug',function(msg){
        console.log('[INFO]['+name+']\t'+formatDate(new Date())+' - '+msg);
    });
}
function formatDate(date){
    var day = date.getDate(),
        month = date.getMonth()+1,
        year = date.getFullYear();

    var hour = date.getHours(),
        minutes = date.getMinutes(),
        seconds = date.getSeconds(),
        milliseconds = date.getMilliseconds();

    return `${month}/${day}/${year} ${hour}:${minutes}:${seconds}.${milliseconds}`;
}

function getBadgeList(args,cb){
    var no_cache = args.no_cache || false;

    // First, let's check if we have a valid cache file
    if (!no_cache && fs.existsSync('./cache.json')){
        var fileContent = JSON.parse(fs.readFileSync('./cache.json'));
        var cacheDate = new Date(fileContent.timestamp);
        var maxDate = new Date(new Date() - 5*60000);
        
        if (cacheDate >= maxDate){
            return cb(fileContent.list);
        }else 
            return User.badgeList(function(list){
                updateCache(list);
                cb(list);
            });
    }else
        return User.badgeList(function(list){
            updateCache(list);
            cb(list);
        });
}
function updateCache(list){
    var cache = {};
    cache.timestamp = new Date().toISOString();
    cache.list = list;
    fs.writeFileSync('./cache.json',JSON.stringify(cache));
}