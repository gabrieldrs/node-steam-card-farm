var EventEmitter = require('events').EventEmitter;

Idler.prototype.remainingGames = 0;
Idler.prototype.finishedGames = 0;
function Idler(User,gameList){
    this._user = User;
    this.remainingGames = getGamesWithCardDrops(gameList);
    this.finishedGames = getGamesWithoutCardDrops(gameList);
    EventEmitter.call(this);
}
require('util').inherits(Idler, EventEmitter);

Idler.prototype.updateGamesLists = function(gameList){
    this.remainingGames = getGamesWithCardDrops(gameList);
    this.finishedGames = getGamesWithoutCardDrops(gameList);
    this._updated = true;
}

Idler.prototype.shuffleRemaining = function() {
    var array = this.remainingGames;
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    this.remainingGames = array;
}

Idler.prototype.hasNext = function(){
    if (this.remainingGames > 0){
        return true;
    }
    return false;
}

Idler.prototype.idle = function(args){
    if (this._idling)
        this.stop();
    if (this.remainingGames.length == 0){
        this.emit('debug','List of games to idle has finished.')
        return false;
    }

    var currentList = getGamesToIdleNext(this.remainingGames);
    var gameIds = [];
    this.emit('debug','Going to idle '+currentList.length+' game(s) in this session.');
    for (var i = 0 ; i < currentList.length ; i++){
        this.emit('debug','  Idling: '+currentList[i].game_title);
        gameIds.push({game_id: currentList[i].game_id})
    }

    this._user.gamesPlayed(gameIds);
    this._idling = true;

    if (args && args.time_limit_mnts){
        this.emit('debug', 'Idling will stop automatically after '+args.time_limit_mnts + 'minutes.');
        setStopIdleTime(this, gameIds, args.time_limit_mnts);
    }

    return this._idling;
}

Idler.prototype.stop = function(){
    if (this._idling){
        this.emit('debug', 'Stopping current idle session.');
        this._user.gamesPlayed([]);
        this._idling = false;
    }
}


module.exports = Idler;



//Private
function getGamesWithCardDrops(list){
    var returnList = [];
    for (var i = 0 ; i < list.length ; i++){
        if (list[i].remaining_drops > 0)
            returnList.push(list[i]);
    }
    return returnList;
}

function getGamesWithoutCardDrops(list){
    var returnList = [];
    for (var i = 0 ; i < list.length ; i++){
        if (list[i].remaining_drops <= 0)
            returnList.push(list[i]);
    }
    return returnList;
}

function getGamesToIdleNext(list){
    var returnList = [];
    for (var i = 0,j = 0; i < 10 && j < list.length;j++){
        if (list[j].hours_played < 2) {
            returnList.push(list[j]);
            i++;
        }
    }
    if (returnList.length == 0){
        returnList.push(list.shift());
        list.push(returnList[0]);
    }
    return returnList;
}


function setStopIdleTime(self, games, minutes){
    var milliseconds = minutes*60*1000
    var hours = minutes/60;
    
    setTimeout(function(){
        self.emit('debug',minutes + ' minutes have passed, stopping.');
        if (self._updated) return; // If the list of games was updated during the last idle session, we don't need to manually update it
        for (var i = 0 ; i < games.length ; i++){
            for (var j = 0 ; j < self.remainingGames.length ; j++){
                if (games[i] == self.remainingGames.game_id){
                    self.remainingGames[j].hours_played+=hours;
                    break;
                }
            }
        }
        self.stop();
    },milliseconds);
}