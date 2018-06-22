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

| Name | Description |
| ---- | ----------- |
| start | Start download |
| stop | Stop (pause) download |
| resume | Resume download |
| sleep | Status to json data (use promise) |
| on | Subscribe event |

## Properties

| Name | Description |
| ---- | ----------- |
| status | Download status |
| downloadedBytes | File downloaded |
| fileLength | File length |

## Events

| Name | Description |
| ---- | ----------- |
| progress | Progress change event |
| finish | Download done event |
| pause | Download pause event |
| error | Download error event |
| response | Referer: request response event | 
