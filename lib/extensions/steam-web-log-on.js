const SteamCrypto = require('steam-crypto');

function SteamWebLogOn (steamID, webLoginKey) {
	this._steamID = steamID;
	this._webLoginKey = webLoginKey;
}

SteamWebLogOn.prototype.startWebSession = function (callback) {
	var sessionKey = SteamCrypto.generateSessionKey();
	var steamAuthInterface = generateInterface('ISteamUserAuth');


	var logOnProperties = {
		steamid: this._steamID,
		sessionkey: sessionKey.encrypted,
		encrypted_loginkey: SteamCrypto.symmetricEncrypt(
			new Buffer(this._webLoginKey),
			sessionKey.plain
		)
	};

	steamAuthInterface.post('AuthenticateUser', logOnProperties, function (statusCode, body) {
		if (statusCode !== 200) {
			console.log("Error when trying to start web session");
			console.log(statusCode);
			console.log(body);
			return;
		}

		this.cookies = [
			'sessionid=' + this.sessionID,
			'steamLogin=' + body.authenticateuser.token,
			'steamLoginSecure=' + body.authenticateuser.tokensecure
		];

		callback(this.cookies);

	}.bind(this));
};

function generateInterface(iface,apiKey){
	function request(httpmethod, method, args, callback) {
		if (apiKey)
			args.key = apiKey;
		
		var data = Object.keys(args).map(function(key) {
			var value = args[key];
			if (Array.isArray(value))
				return value.map(function(value, index) {
					return key + '[' + index + ']=' + value;
				}).join('&');
			else if (Buffer.isBuffer(value))
				return key + '=' + value.toString('hex').replace(/../g, '%$&');
			else
				return key + '=' + encodeURIComponent(value);
		}).join('&');
		
		var options = {
			hostname: 'api.steampowered.com',
			path: '/' + iface + '/' + method + '/v1',
			method: httpmethod
		};
		
		if (httpmethod == 'GET')
			options.path += '/?' + data;
		else
			options.headers = {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': data.length
			};
		
		var req = require('https').request(options, function(res) {
			if (res.statusCode != 200) {
				callback(res.statusCode);
				return;
			}
			var data = '';
			res.on('data', function(chunk) {
				data += chunk;
			});
			res.on('end', function() {
				callback(res.statusCode, JSON.parse(data));
			});
		});
		
		req.on('error', function() {
			request(httpmethod, method, version, args, callback);
		});
		
		if (httpmethod == 'POST')
			req.end(data);
		else
			req.end();
	}
	  
	return {
		get: request.bind(null, 'GET'),
		post: request.bind(null, 'POST')
	};
}

module.exports = SteamWebLogOn;