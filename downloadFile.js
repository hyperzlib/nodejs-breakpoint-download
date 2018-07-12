var request = require('request');
var Crypto = require('crypto');
var fs = require('fs');

function downloadFile(...args){
	var downReq;
	var fp;
	var emitter = new events.EventEmitter();
	var lastDataTime = 0;
	var nowTime = 0;
	var lastDownloaded = 0;
	this.status = 'prepare';
	this.downloadSpeed = 0;
	this.downloadedBytes = 0;
	this.fileLength = 0;
	this.etag = '';
	this.on = emitter.on;
	this.emit = emitter.emit;
	this.file = '';
	this.url = '';
	this.tempFile = '';
	this.taskId = null;
	this.timeout = 5;

	this.bindOndata = function(){
		var _this = this;
		var isAbort = false;
		function downData(data){
			fs.writeSync(fp, data);
			nowTime = (new Date()).getTime();
			if(nowTime - lastDataTime > 1000){
				_this.downloadSpeed = lastDownloaded / ((nowTime - lastDataTime) / 1000);
				lastDataTime = nowTime;
				lastDownloaded = data.length;
			} else {
				lastDownloaded += data.length;
			}
			_this.downloadedBytes += data.length;
			_this.emit('progress', _this.downloadedBytes, _this.fileLength);
			data = null;
		}
		downReq.on('data', downData);
		downReq.on('abort', function(){
			isAbort = true;
		});
		downReq.on('end', function(){
			if(_this.taskId != null){
				clearInterval(_this.taskId);
				_this.taskId = null;
			}
			if(!isAbort){
				fs.closeSync(fp);
				fs.renameSync(_this.tempFile, _this.file);
				_this.status = 'finish';
				_this.emit('finish', _this.file);
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
		lastDataTime = 0;
		lastDownloaded = 0;
		this.downloadSpeed = 0;
		var _this = this;
		if(fs.existsSync(this.tempFile)){
			fs.unlinkSync(this.tempFile);
		}
		this.downloadedBytes = 0;
		fp = fs.openSync(this.tempFile, 'a+');
		downReq = request.get(this.url, {
			strictSSL: false,
		});
		downReq.on('response', function(data){
			//console.log(data);
			_this.taskId = setInterval(function(){
				_this.task();
			}, 1000);
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
		lastDataTime = 0;
		lastDownloaded = 0;
		this.downloadSpeed = 0;
		try {
			downReq.abort();
			fs.closeSync(fp);
		} catch(e) {}
		this.status = 'paused';
	};

	this.resume = function(){
		var _this = this;
		lastDataTime = 0;
		lastDownloaded = 0;
		this.downloadSpeed = 0;
		downReq = request.get(this.url, {
			headers: {
				Range: "bytes=" + this.downloadedBytes.toString() + "-",
			},
			strictSSL: false,
		});
		downReq.on('response', function(data){
			_this.taskId = setInterval(function(){
				_this.task();
			}, 1000);
			if(_this.etag == null || data.headers.etag != _this.etag || data.statusCode != 206){
				//console.log(_this.etag, data.headers.etag, data.statusCode);
				_this.downloadedBytes = 0;
				if(fs.existsSync(_this.tempFile)){
					fs.unlinkSync(_this.tempFile);
				}
			}
			_this.emit('response', data);
			_this.emit('progress', _this.downloadedBytes, _this.fileLength);
		});
		fp = fs.openSync(this.tempFile, 'a+');
		this.bindOndata();
		this.status = 'downloading';
	};
	
	this.sleep = function(){
		var _this = this;
		return new Promise(function(resolve, reject){
			_this.stop();
			var md5 = _this.getPartMd5Sync(_this.tempFile);
			var sleepData = {
				file: _this.file,
				url: _this.url,
				tempFile: _this.tempFile,
				etag: _this.etag,
				md5: md5,
				downloaded: _this.downloadedBytes,
				fLength: _this.fileLength,
			};
			resolve(sleepData);
		});
	};

	this.sleepSync = function(){
		var _this = this;
		_this.stop();
		var md5 = _this.getPartMd5Sync(_this.tempFile);
		var sleepData = {
			file: _this.file,
			url: _this.url,
			tempFile: _this.tempFile,
			etag: _this.etag,
			md5: md5,
			downloaded: _this.downloadedBytes,
			fLength: _this.fileLength,
		};
		return sleepData;
	};

	this.getPartMd5Sync = function(file, length){
		if(fs.existsSync(file)){
			var fp = fs.openSync(file, 'r');
			var stat = fs.statSync(file);
			var fsize = stat.size;
			var hash = Crypto.createHash('md5');
			var fseek = 0;
			var chunkLength = 1024 * 4096;
			if(typeof length == 'undefined'){
				length = fsize;
			}
			var loopNum = Math.floor(Math.min(fsize, length) / chunkLength);
			var resize = Math.min(fsize, length) % chunkLength;
			var tChunk = new Uint8Array(chunkLength);
			for(var i = 0; i < loopNum; i ++){
				fs.readSync(fp, tChunk, 0, chunkLength, fseek);
				fseek += chunkLength;
				hash.update.bind(hash)(tChunk);
			}
			var tChunk = new Uint8Array(resize);
			fs.readSync(fp, tChunk, 0, resize, fseek);
			hash.update.bind(hash)(tChunk);
			return hash.digest('hex');
		} else {
			return '0'.repeat(32);
		}
	};

	this.copyPart = function(from, to, length){
		if(fs.existsSync(to)){
			fs.unlinkSync(to);
		}
		var stat = fs.statSync(from);
		length = Math.min(length, stat.size);
		var fp1 = fs.openSync(from, 'r');
		var fp2 = fs.openSync(to, 'w');
		var fseek = 0;
		var chunkLength = 1024 * 4096;
		var tChunk = new Uint8Array(chunkLength);
		var loopNum = length / chunkLength;
		var resize = length % chunkLength;
		for(var i = 0; i < loopNum; i ++){
			fs.readSync(fp1, tChunk, 0, chunkLength, fseek);
			fs.writeSync(fp2, tChunk);
			fseek += tChunk;
		}
		tChunk = new Uint8Array(resize);
		fs.readSync(fp1, tChunk, 0, resize, fseek);
		fs.writeSync(fp2, tChunk);
		return length;
	};
	
	this.init = function(args){
		var _this = this;
		if(args.length == 2){
			this.url = args[0];
			this.file = args[1];
			this.tempFile = this.file + '.hzdownload';
		} else if(args.length == 1) {
			var data = args[0];
			this.file = data.file;
			this.url = data.url;
			this.tempFile = data.tempFile;
			if(fs.existsSync(this.tempFile)){
				if(data.md5 == this.getPartMd5Sync(this.tempFile, data.downloaded)){
					//如果文件大小不同，就截取
					var fLen = fs.statSync(this.tempFile).size;
					if(fLen > data.downloaded){
						fs.renameSync(this.tempFile, this.tempFile + '2');
						if(this.copyPart(this.tempFile, this.tempFile + '2', data.downloaded) == data.downloaded){
							fs.unlinkSync(this.tempFile + '2');
							_this.etag = data.etag;
							_this.downloadedBytes = data.downloaded;
							_this.fileLength = data.fLength;
						}
					} else if(fLen == data.downloaded){
						_this.etag = data.etag;
						_this.downloadedBytes = data.downloaded;
						_this.fileLength = data.fLength;
					}
				}
			}
		}
	};

	this.task = function(){
		if((new Date()).getTime() - nowTime > this.timeout * 1000){
			this.stop();
			this.resume();
		}
	}

	this.init(args);
}
module.exports = downloadFile;