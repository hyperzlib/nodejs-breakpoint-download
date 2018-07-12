# nodejs-breakpoint-download
A nodejs breakpoint download library
## Usage
```javascript
var down = new downloadFile(url, dstFile);
down.start();
```
## Construct
```javascript
new downloadFile(url, dstFile);
new downloadFile(sleepData);
```

## Functions

| Name | Description | Arguments | Returns |
| ---- | ----------- | --------- | ------- |
| __construct | The construct function | (url : string, file : string) or (sleepData : object) | ... |
| start | Start download | void | void |
| stop | Stop (pause) download | void | void |
| resume | Resume download | void | void |
| sleep | Status to json data (use promise) | void | sleepData(in promise) : object |
| sleepSync | sleep sync mode | void | sleepData : object |
| on | Subscribe event | (event, callback) | void |

## Properties

| Name | Description |
| ---- | ----------- |
| status | Download status : string (In prepare, downloading, paused, finish, error) |
| downloadedBytes | File downloaded : int |
| downloadedSpeed | Download speed : int |
| timeout | Connect timeout : int |
| fileLength | File length : int |

## Events

| Name | Description | Returns |
| ---- | ----------- | ------- |
| progress | Progress change event | (downloadBytes : int, fileLength : int) |
| finish | Download done event | Download filename : string |
| pause | Download pause event | void |
| error | Download error event | Error Data : error |
| response | Referer: request response event | Response Data : object |
