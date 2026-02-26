# Activity Detector
## Notes
- Supported video extensions: mp4, mov

## Requirements
- Docker (tested on version 28.0.1)

## Set up
#### Backend
In order for backend to work path to videos folder must be specified.  
Path can be specified by:
- Setting up `VIDEO_FOLDER_PATH` environment variable to directory video directory absolute path  
  OR
- Changing `folderPath` property in `backend\src\main\resources\application.yaml` file.
###### Backend properties description
- `folderPath` - property specifies the folder from which video files will be registered.  
  *Property must be in path\to\dir format*
- `subfolderDepth` - property specifies how many levels of subfolders under `folderPath` will also be
  monitored, where depth `0` means only `folderPath` itself, without any subfolders.  
  *Values [0, 4]*
- `show-error-details-in-response` - true/false value whether to show exception details in http response bodies.  
  *Default: false*


## Docker environment
**To start project containers run:**
```
docker compose -f docker/docker-compose.yml up 
```
*(--build flag can be added for image rebuilding purposes)*  
*(db container must be up for backend to start without errors!)*
## Backend endpoints

##### GET /videos?page=&size=&sort=
Return JSON of registered video records page.
**Params:**
- *page* - page number (from 0, optional, default: page=0)
- *size* - number of elements per page (optional, default: size=10)
- *sort* - comma seperated sort list (optional, default: sort=uploadDate,desc&sort=name)  
*To sort the results by more than one property, keep adding as many sort=PROPERTY parameters as you need.*  

**Example request**  
`http://localhost:8080/videos?size=2`
```json
{
  "content": [
      {
      "id": "736b52f2-c2e3-4e83-9f17-2077f18ec9cd",
      "name": "VIDEO_NAME",
      "description": "DESCRIPTION",
      "upload_date": "2026-02-18T19:18:19.244461"
      },
      {
      "id": "d0544456-34d5-49fc-9372-0c3f164f56b0",
      "name": "VIDEO_NAME",
      "description": "DESCRIPTION",
      "upload_date": "2026-02-18T19:16:32.147637"
      }
  ],
  "page": {
      "size": 2,
      "number": 0,
      "totalElements": 3,
      "totalPages": 2
  }
}
```
##### GET /videos/{video_id}/info
Specified video details.  

**Request example**  
`localhost:8080/videos/736b52f2-c2e3-4e83-9f17-2077f18ec9cd/info`
```json
{
"events": [
    {
    "label": "DETECTION_LABEL",
    "timestamp": { 
        "from": "PT0S", //Duration in ISO-8601 format
        "to": "PT1S"
        }
    }
],
"detections": [
    {
    "objects": [
        {
        "name": "human",
        "count": 0
        }
    ],
    "timestamp": {
        "from": "PT0S",
        "to": "PT1S"
        }
    }
]
}
```


##### GET /videos/{video_id}
Request for video partial content.

##### POST /videos/upload
*multipart/form-data*
Request parameters
- *file* - video file with supported extension.
- *video-name* - video name which will be assigned in database
- *description* - description for video (optional)
- *relative-path* - path in which video will be saved in backend's file system.
- *details* - details json
  *details example*
```json
{
"events": [
    {
    "label": "DETECTION_LABEL",
    "timestamp": {
        "from": "PT0S",
        "to": "PT1S"
        }
    }
],
"detections": [
    {
    "objects": [
        {
        "name": "human",
        "count": 0
        }
    ],
    "timestamp": {
        "from": "PT0S",
        "to": "PT1S"
        }
    }
]
}
```
Saves specified video.

**Example request**
```
curl -X POST http://localhost:8080/videos/upload `
 -F "file=@C:\Users\User\Videos\test_video.mov" `
 -F "video-name=VIDEO_NAME" `
 -F "description=DESCRIPTION" `
 -F "relative-path=saved_video.mov" `
 -F 'details={"events":[{"label":"DETECTION_LABEL","timestamp":{"from":"PT0S","to":"PT1S"}}],"detections":[{"objects":[{"name":"human","count":1}],"timestamp":{"from":"PT0S","to":"PT1S"}}]};type=application/json'
```
## Frontend endpoint (temporary overview build)
##### GET /
Check if frontend is running.

##### GET /video/{video_id}
Presentation of video with video_id, in simple in-browser player.