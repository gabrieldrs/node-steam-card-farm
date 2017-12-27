const util = require('util');
const fs = require('fs');

const Steam = require('steam');
const SteamUser = Steam.SteamUser;
const EMsg = Steam.EMsg;
var schema = Steam.Internal;

const WebLogOn = require('./extensions/steam-web-log-on');

const request = require('request');
const Cheerio = require('cheerio');

function SteamUserPlus(steamClient) {
    SteamUserPlus.super_.call(this,steamClient);
}
util.inherits(SteamUserPlus, SteamUser);


// Methods

SteamUserPlus.prototype.badgeList = function(args,cb){
    this.emit('debug',"Requiring badges");
    var returnList = [];

    var no_cache = args.no_cache || false;


    // First, let's check if we have a valid cache file
    if (!no_cache && fs.existsSync('./cache.json')){
        this.emit('debug','Cache file found, loading it');
        var fileContent = JSON.parse(fs.readFileSync('./cache.json'));
        var cacheDate = new Date(fileContent.timestamp);
        var maxDate = new Date(new Date() - 5*60000);
        
        if (cacheDate >= maxDate){
            this.emit('debug',"Using cached file");
            updateCache(this, fileContent.list);
            cb(fileContent.list);
            return;
        }else 
            this.emit('debug','Cache file too old, getting badge list again.');
    }

    if (!this._cookies){
        this.emit('error','Before getting the list of badges, you must login.')
        this._client.disconnect()
        return;
    }
    var req = requestWithCookies(this._cookies);
    var self = this;
    req.get('http://steamcommunity.com/my/badges/',function(err,resp,body){
        if (err){
            self._client.disconnect()
            return;
        }
        self.emit('debug','Badge list downloaded successfully');
        var $ = Cheerio.load(body);
        for (var i = 0;i<$('.badge_title_row').get().length;i++){
            var game_info = $('.badge_title_row').get(i);
            if ($('.badge_title_playgame', game_info).html()){
                var raw_progress = $('.progress_info_bold', game_info).html()
                var remaining_drops = raw_progress.split(' ')[0];
        
                var raw_title = $('.badge_title', game_info).text();
                var game_title = raw_title.replace("View details","").trim();
        
                var play_button = $('.btn_green_white_innerfade.btn_small_thin',game_info);
                var play_button_href = play_button.attr('href');
                var game_id = play_button_href.match(/steam:\/\/run\/(\d+)/)[1];

                var raw_hours_played = $('.badge_title_stats_playtime',game_info).text();
                var hours_played = raw_hours_played.split(" ")[0].trim() || '0';

                returnList.push({
                    game_title: game_title,
                    game_id: game_id,
                    remaining_drops: parseInt(remaining_drops),
                    hours_played: parseFloat(hours_played)
                });
            }
        }
        self.emit('debug','Badge list parsed successfully');
        updateCache(self, returnList);
        cb(returnList);
    });
}

SteamUserPlus.prototype.logOn = function(logOnDetails){
    SteamUserPlus.super_.prototype.logOn.call(this,logOnDetails);
    var logonCB = function(data){
        this._client.removeListener('logOnResponse',logonCB);
        if (data.eresult == EMsg.AccountLoginDeniedNeedTwoFactor){ //85
            console.log("Missing two factor auth code.")
            this._client.disconnect();
        }
        if (data.eresult == EMsg.TwoFactorCodeMismatch){ //88
            console.log("Two factor auth code wrong.")
            this._client.disconnect();
        }
        var logOn = new WebLogOn(this._client.steamID,data.webapi_authenticate_user_nonce);
        logOn.startWebSession(function(cookies){
            this._cookies = cookies;

            this.emit('webLogOnResponse');
        }.bind(this))
    }.bind(this)
    this._client.on('logOnResponse',logonCB)
}

module.exports = SteamUserPlus;


// Private
function requestWithCookies(cookies){
    var jar_of_cookies = request.jar()
    for (var i = 0; i < cookies.length;i++){
        jar_of_cookies.setCookie(request.cookie(cookies[i]), 'http://steamcommunity.com');
        jar_of_cookies.setCookie(request.cookie(cookies[i]), 'http://store.steampowered.com');
        jar_of_cookies.setCookie(request.cookie(cookies[i]), 'https://store.steampowered.com');
    }
    jar_of_cookies.setCookie(request.cookie("Steam_Language=english"), 'http://steamcommunity.com');
    return request.defaults({jar:jar_of_cookies});
}

function updateCache(user, list){
    user.emit('debug','Saving badge list to cache');
    var cache = {};
    cache.timestamp = new Date().toISOString();
    cache.list = list;
    fs.writeFileSync('cache.json',JSON.stringify(cache));
    user.emit('debug','Badge list cached');
}
