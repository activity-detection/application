<h1 align="center">
📹 Activity Detector
</h1>

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
  _Property must be in path\to\dir format_
- `subfolderDepth` - property specifies how many levels of subfolders under `folderPath` will also be
  monitored, where depth `0` means only `folderPath` itself, without any subfolders.  
  _Values [0, 4]_
- `show-error-details-in-response` - true/false value whether to show exception details in http response bodies.  
  _Default: false_

## Docker environment

**To start project containers run:**

```
docker compose -f docker/docker-compose.yml up
```

_(--build flag can be added for image rebuilding purposes)_  
_(db container must be up for backend to start without errors!)_

## Backend endpoints

#### Videos

##### GET /videos?page=&size=&sort=&from=&to=

Return JSON of registered video records page.
**Params:**

- _page_ - page number (from 0, optional, default: page=0)
- _size_ - number of elements per page (optional, default: size=10)
- _sort_ - comma seperated sort list (optional, default: sort=uploadDate,desc&sort=name)  
  _To sort the results by more than one property, keep adding as many sort=PROPERTY parameters as you need._
- _from_ - filter videos from this date-time (ISO-8601 format, optional)
- _to_ - filter videos up to this date-time (ISO-8601 format, optional)

**Example request**  
`http://localhost:8080/videos?size=2`  
**Example response**

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
    },
    {
      "id": "ed29641e-4ccc-435a-86b4-5819729fbfeb",
      "name": "VIDEO_NAME",
      "description": "DESCRIPTION",
      "upload_date": "2026-04-01T15:18:25.768707",
      "continuation_of": "d0544456-34d5-49fc-9372-0c3f164f56b0" //Specifies continued video id
    }
  ],
  "page": {
    "size": 3,
    "number": 0,
    "totalElements": 3,
    "totalPages": 1
  }
}
```

##### GET /videos/sequences?page=&size=&sort=&from=&to=

Returns JSON of video sequences.
**Params:**

- _page_ - page number (from 0, optional, default: page=0)
- _size_ - number of elements per page (optional, default: size=10)
- _sort_ - comma seperated sort list (optional, default: sort=uploadDate,desc&sort=name)  
  _To sort the results by more than one property, keep adding as many sort=PROPERTY parameters as you need._
- _from_ - filter sequences from this date-time (ISO-8601 format, optional)
- _to_ - filter sequences up to this date-time (ISO-8601 format, optional)

**Example request**  
`http://localhost:8080/videos/sequences?size=3`  
**Example response**

```json
{
  "content": [
    {
      "origin_id": "a12b0ccf-602b-471a-941e-c1037b5542f3", // id of video at the beginning of sequence
      "sequence_upload_date": "2026-04-02T17:44:36.934171", // upload_date of last video in sequence (ergo of complete sequence)
      "parts": [
        // videos that the sequence consists of, in correct order
        {
          "id": "a12b0ccf-602b-471a-941e-c1037b5542f3",
          "name": "Video2",
          "description": "DESCRIPTION",
          "upload_date": "2026-04-02T17:44:36.934171"
        }
      ]
    },
    {
      "origin_id": "14bbd270-e4e9-4797-9f2e-df638263cc38",
      "sequence_upload_date": "2026-04-02T17:44:16.148842",
      "parts": [
        {
          "id": "14bbd270-e4e9-4797-9f2e-df638263cc38",
          "name": "Video1",
          "description": "DESCRIPTION",
          "upload_date": "2026-04-02T17:44:16.148842"
        },
        {
          "id": "5d4628aa-d61a-4391-b1d8-1f37617d3571",
          "name": "Video1-2",
          "description": "DESCRIPTION",
          "upload_date": "2026-04-02T17:45:19.682346",
          "continuation_of": "14bbd270-e4e9-4797-9f2e-df638263cc38"
        }
      ]
    }
  ],
  "page": {
    "size": 3,
    "number": 0,
    "totalElements": 2,
    "totalPages": 1
  }
}
```

##### GET /videos/sequences/{originId}

Returns JSON of video sequence specified by its origin video's id.
**Params:**

- _originId_ - origin video's id

**Example request**  
`http://localhost:8080/videos/sequences/14bbd270-e4e9-4797-9f2e-df638263cc38`  
**Example response**

```json
{
  "origin_id": "14bbd270-e4e9-4797-9f2e-df638263cc38", // id of video at the beginning of sequence
  "sequence_upload_date": "2026-04-02T17:45:19.682346", // upload_date of last video in sequence (ergo of complete sequence)
  "parts": [
    // videos that the sequence consists of, in correct order
    {
      "id": "14bbd270-e4e9-4797-9f2e-df638263cc38",
      "name": "VIDEO_NAME",
      "description": "DESCRIPTION",
      "upload_date": "2026-04-02T17:44:16.148842"
    },
    {
      "id": "5d4628aa-d61a-4391-b1d8-1f37617d3571",
      "name": "dowiazanie",
      "description": "DESCRIPTION",
      "upload_date": "2026-04-02T17:45:19.682346",
      "continuation_of": "14bbd270-e4e9-4797-9f2e-df638263cc38"
    }
  ]
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

##### GET /videos/sequences/{originId}/manifest.mpd

Returns manifest file for DASH protocol (Dynamic Adaptive Streaming over HTTP).
**Params:**

- _originId_ - origin video's id

**Example request**  
`http://localhost:8080/videos/sequences/14bbd270-e4e9-4797-9f2e-df638263cc38/manifest.mpd`

##### GET /videos/{fileIdentifier}/manifest.mpd

Returns manifest file for DASH protocol for a single video.
**Params:**

- _fileIdentifier_ - video identifier

**Example request**  
`http://localhost:8080/videos/736b52f2-c2e3-4e83-9f17-2077f18ec9cd/manifest.mpd`

##### GET /videos/sequences/{originId}/dash/{videoId}/{assetPath}

Returns DASH asset (segment or initialization segment) for a video in a sequence.
**Params:**

- _originId_ - origin video's id
- _videoId_ - video id within the sequence
- _assetPath_ - path to the requested asset

**Example request**  
`http://localhost:8080/videos/sequences/14bbd270-e4e9-4797-9f2e-df638263cc38/dash/5d4628aa-d61a-4391-b1d8-1f37617d3571/segment.m4s`

##### GET /videos/{fileIdentifier}/dash/{assetPath}

Returns DASH asset for a single video.
**Params:**

- _fileIdentifier_ - video identifier
- _assetPath_ - path to the requested asset

**Example request**  
`http://localhost:8080/videos/736b52f2-c2e3-4e83-9f17-2077f18ec9cd/dash/segment.m4s`

##### POST /videos/upload

_multipart/form-data_
Upload of video via multipart/form-data. Returns id of saved video file.
Request parameters

- _file_ - video file with supported extension.
- _video-name_ - video name which will be assigned in database
- _description_ - description for video (optional)
- _relative-path_ - path in which video will be saved in backend's file system.
- _continuation-of_ - id of continued video. (optional)
- _details_ - details json
  _details example_

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
 -F "continuation-of=16aaeafb-1f25-4b0b-aae3-3958bdc435fe" `
 -F 'details={"events":[{"label":"DETECTION_LABEL","timestamp":{"from":"PT0S","to":"PT1S"}}],"detections":[{"objects":[{"name":"human","count":1}],"timestamp":{"from":"PT0S","to":"PT1S"}}]};type=application/json'
```

##### DELETE /videos/{video_id}

Deletes video from database and disk space.
**Example request**

```
curl -X DELETE http://localhost:8080/videos/1c383b78-63a7-4058-8297-55e8a873f06b
```

##### DELETE /videos/sequences/{fileIdentifier}

Deletes video sequence from database and disk space.
**Params:**

- _fileIdentifier_ - video sequence identifier (origin video id)

**Example request**

```
curl -X DELETE http://localhost:8080/videos/sequences/14bbd270-e4e9-4797-9f2e-df638263cc38
```

#### Detection rules

##### GET /rules/elements

Returns JSON of supported detection elements based on _activity-detector.detected-elements_ application property.
**Example request**
``http://localhost:8080/rules/elements`
**Example response**

```json
[
  {
    "id": 1,
    "name": "human"
  },
  {
    "id": 2,
    "name": "knife"
  },
  {
    "id": 3,
    "name": "backpack"
  }
]
```

##### GET /rules?page=&size=&sort=

Return JSON of saved detection templates page.
**Params:**

- _page_ - page number (from 0, optional, default: page=0)
- _size_ - number of elements per page (optional, default: size=10)
- _sort_ - comma seperated sort list (optional, default: sort=name)  
  _To sort the results by more than one property, keep adding as many sort=PROPERTY parameters as you need._

**Example request**  
`http://localhost:8080/rules?size=2`  
**Example response**

```json
{
  "content": [
    {
      "name": "Stranger_Danger", //Template name
      "vector_count": 1, //Number of diffrent rule vectors meeting template's detection criteria
      "vectors": [
        {
          "vector_id": 10,
          "rules": [
            //List of detection vector rules
            {
              "count": 12,
              "range": false, //Does rule contain requirements in range (count_from, count_to)
              "element_name": "knife" //Detected element name
            },
            {
              "range": true,
              "element_name": "human",
              "count_from": 10,
              "count_to": 55
            }
          ]
        }
      ]
    }
  ],
  "page": {
    "size": 10,
    "number": 0,
    "totalElements": 2,
    "totalPages": 1
  }
}
```

##### POST /rules

Creates new detection template.  
**Example request body**

```json
{
  "name": "Stranger_Danger", //Created detection template name
  "vectors": [
    //Created template list of rule vectors
    {
      "rules": [
        //Vector rules
        {
          "element_name": "knife", //Detected element name
          "count": 5 //non-range count
        },
        {
          "element_name": "human",
          "count_from": 10, //count in range
          "count_to": 50 //count in range
        }
      ]
    }
  ]
}
```

**Example request**

```
curl -X POST 'http://localhost:8080/rules' `
--header 'Content-Type: application/json' `
--data '{
    "name": "Malware_Detection_Standard",
    "vectors": [
        {
            "rules": [
                {
                    "element_name": "knife",
                    "count": 5
                },
                {
                    "element_name": "human",
                    "count_from": 10,
                    "count_to": 50
                }
            ]
        }
    ]
}'
```

##### PUT /rules

Edits existing detection template.
_Note: this requires full set of vectors and rules as old vectors are replaced_
**Example request body**

```json
{
  "name": "Stranger_Danger", //Edited template name
  "new_name": "Friendly_Friend", //*Optional* edited template's new name
  "vectors": [
    {
      "vector_id": 1,
      "rules": [
        {
          "element_name": "human",
          "count": 12
        }
      ]
    }
  ]
}
```

**Example request**

```
curl.exe -X PUT 'http://localhost:8080/rules' `
--header 'Content-Type: application/json' `
--data '{
    "name": "Malware_Detection_Standard",
    "vectors": [
        {
            "vector_id": 1,
            "rules": [
                {
                    "element_name": "process_count",
                    "count": 12
                }
            ]
        }
    ]
}'
```

##### DELETE /rules

Deletes specified template.
**Params:**

- _name_ - template name to delete

**Example request**

```
curl -X DELETE 'http://localhost:8080/rules/?name=Malware_Detection_v2'
```

#### Forbidden Zones

##### GET /zones

Returns JSON of all forbidden zones.

**Example request**  
`http://localhost:8080/zones`

**Example response**

```json
[
  {
    "id": 1,
    "name": "Restricted Area A",
    "policy": "ALERT",
    "points": [
      [100.0, 150.0],
      [200.0, 150.0],
      [200.0, 250.0],
      [100.0, 250.0]
    ],
    "active": true,
    "reference_video_id": "736b52f2-c2e3-4e83-9f17-2077f18ec9cd",
    "aspect_ratio": 1.5
  }
]
```

##### POST /zones

Creates new forbidden zone.

**Example request body**

```json
{
  "name": "Restricted Area A",
  "points": [
    [100.0, 150.0],
    [200.0, 150.0],
    [200.0, 250.0],
    [100.0, 250.0]
  ],
  "reference_video_id": "736b52f2-c2e3-4e83-9f17-2077f18ec9cd",
  "aspect_ratio": 1.5
}
```

**Example request**

```
curl -X POST 'http://localhost:8080/zones' \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "Restricted Area A",
    "points": [[100.0, 150.0], [200.0, 150.0], [200.0, 250.0], [100.0, 250.0]],
    "reference_video_id": "736b52f2-c2e3-4e83-9f17-2077f18ec9cd",
    "aspect_ratio": 1.5
  }'
```

##### PUT /zones/{id}

Updates an existing forbidden zone.

**Params:**

- _id_ - zone id

**Example request body**

```json
{
  "name": "Restricted Area A Updated",
  "points": [
    [100.0, 150.0],
    [250.0, 150.0],
    [250.0, 300.0],
    [100.0, 300.0]
  ],
  "reference_video_id": "736b52f2-c2e3-4e83-9f17-2077f18ec9cd",
  "aspect_ratio": 2.0
}
```

**Example request**

```
curl -X PUT 'http://localhost:8080/zones/1' \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "Restricted Area A Updated",
    "points": [[100.0, 150.0], [250.0, 150.0], [250.0, 300.0], [100.0, 300.0]],
    "reference_video_id": "736b52f2-c2e3-4e83-9f17-2077f18ec9cd",
    "aspect_ratio": 2.0
  }'
```

**Example response**

```json
{
  "id": 1,
  "name": "Restricted Area A Updated",
  "policy": "ALERT",
  "points": [
    [100.0, 150.0],
    [250.0, 150.0],
    [250.0, 300.0],
    [100.0, 300.0]
  ],
  "active": true,
  "reference_video_id": "736b52f2-c2e3-4e83-9f17-2077f18ec9cd",
  "aspect_ratio": 2.0
}
```

##### DELETE /zones/{id}

Deletes forbidden zone.

**Params:**

- _id_ - zone id

**Example request**

```
curl -X DELETE 'http://localhost:8080/zones/1'
```

#### Detector Configuration

##### GET /detector/config

Returns current detector configuration including zones, crowd detection settings, and action classes.

**Headers (optional):**

- _If-None-Match_ - ETag for cache validation

**Example request**  
`http://localhost:8080/detector/config`

**Example response**

```json
{
  "version": "1.0.0",
  "zones": [
    {
      "name": "Restricted Area A",
      "policy": "ALERT",
      "points": [
        [100.0, 150.0],
        [200.0, 150.0],
        [200.0, 250.0],
        [100.0, 250.0]
      ]
    }
  ],
  "crowd": {
    "min_people": 5,
    "radius_px": 100.0
  },
  "action_classes": [
    {
      "name": "running",
      "template": "human_movement_fast",
      "thresholds": {
        "confidence": 80
      },
      "warnings": ["High activity detected"]
    }
  ]
}
```

## Frontend endpoint (temporary overview build)

##### GET /

Check if frontend is running.

##### GET /video/{video_id}

Presentation of video with video_id, in simple in-browser player.

