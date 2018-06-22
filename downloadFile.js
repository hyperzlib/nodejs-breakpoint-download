var request = require('request');
var Crypto = require('crypto');
var fs = require('fs');

function downloadFile(...args){
	var downReq;
	var tempFile;
	var fp;
	var url;
	var file;
	var emitter = new events.EventEmitter();
	this.status = 'prepare';
	this.downloadedBytes = 0;
	this.fileLength = 0;
	this.etag = '';
	this.on = emitter.on;
	this.emit = emitter.emit;

	this.bindOndata = function(){
		var _this = this;
		var isAbort = false;
		downReq.on('data', function(data){
			_this.downloadedBytes += data.length;
			//console.log(_this.downloadedBytes);
			fs.writeSync(fp, data);
			_this.emit('progress', _this.downloadedBytes, _this.fileLength);
		});
		downReq.on('abort', function(){
			isAbort = true;
		});
		downReq.on('end', function(){
			//console.log('end');
			if(!isAbort){
				fs.closeSync(fp);
				fs.renameSync(tempFile, file);
				_this.status = 'finish';
				_this.emit('finish', file);
			} else {
				isAbort = false;
				_this.emit('pause');
			}
		});
		downReq.on('error', function(e){
			fs.closeSync(fp);
			_this.emit('error', e);
			_this.status = 'error';
		});
	};

	this.start = function(){
		var _this = this;
		if(fs.existsSync(tempFile)){
			fs.unlinkSync(tempFile);
		}
		this.downloadedBytes = 0;
		fp = fs.openSync(tempFile, 'a+');
		downReq = request.get(url, {
			strictSSL: false,
		});
		downReq.on('response', function(data){
			//console.log(data);
			if(typeof data.headers.etag != 'undefined'){
				_this.etag = data.headers.etag;
			}
			_this.fileLength = parseInt(data.headers["content-length"]);
			_this.emit('response', data);
			_this.emit('progress', _this.downloadedBytes, _this.fileLength);
		});
		this.status = 'downloading';
		this.bindOndata();
	};

	this.stop = function(){
		try {
			downReq.abort();
			fs.closeSync(fp);
		} catch(e) {}
		this.status = 'paused';
	};

	this.resume = function(){
		var _this = this;
		downReq = request.get(url, {
			headers: {
				Range: "bytes=" + this.downloadedBytes.toString() + "-",
			},
			strictSSL: false,
		});
		downReq.on('response', function(data){
			if(_this.etag == null || data.headers.etag != _this.etag || data.statusCode != 206){
				//console.log(_this.etag, data.headers.etag, data.statusCode);
				_this.downloadedBytes = 0;
				if(fs.existsSync(tempFile)){
					fs.unlinkSync(tempFile);
				}
			}
			_this.emit('response', data);
			_this.emit('progress', _this.downloadedBytes, _this.fileLength);
		});
		fp = fs.openSync(tempFile, 'a+');
		this.bindOndata();
		this.status = 'downloading';
	};
	
	this.sleep = function(){
		var _this = this;
		return new Promise(function(resolve, reject){
			_this.stop();
			var rs = fs.createReadStream(tempFile);
			var hash = Crypto.createHash('md5');
			rs.on('data', hash.update.bind(hash));
			rs.on('end', function(){
				var md5 = hash.digest('hex');
				var sleepData = {
					file: file,
					url: url,
					tempFile: tempFile,
					etag: _this.etag,
					md5: md5,
					downloaded: _this.downloadedBytes,
					fLength: _this.fileLength,
				};
				resolve(sleepData);
			});
		});
	};
	
	this.unsleep = function(data){
		var _this = this;
		return new Promise(function(resolve, reject){
			
		});
	};
	
	this.init = function(args){
		var _this = this;
		if(args.length == 2){
			url = args[0];
			file = args[1];
			tempFile = file + '.pdcdownload';
		} else if(args.length == 1) {
			var data = args[0];
			file = data.file;
			url = data.url;
			tempFile = data.tempFile;
			if(fs.existsSync(tempFile)){
				var buffer = fs.readFileSync(tempFile);
				var hash = Crypto.createHash('md5');
				if(data.md5 == hash.update(buffer).digest('hex')){
					_this.etag = data.etag;
					_this.downloadedBytes = data.downloaded;
					_this.fileLength = data.fLength;
				}
			}
		}
	};
	
	this.init(args);
}

module.exports = downloadFile;