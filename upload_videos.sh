#!/bin/bash

set -o errexit
set -o pipefail
set -o nounset

FOLDER="${1:-./tests/videos}"
DETAILS="${2:-}"
DEFAULT_DETAILS="$(
  cat <<'JSON'
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
          "count": 1
        }
      ],
      "timestamp": {
        "from": "PT0S",
        "to": "PT1S"
      }
    }
  ]
}
JSON
)"
DETAILS_TEMP_FILE=""
TEST_BASE_URL="${TEST_BASE_URL:-http://localhost}"
API_PREFIX="${API_PREFIX:-/api}"
UPLOAD_URL="${TEST_BASE_URL%/}${API_PREFIX%/}/videos/upload"
MAX_RETRIES="${MAX_RETRIES:-5}"
SLEEP_INITIAL="${SLEEP_INITIAL:-1}"
RETRY_MULTIPLIER="${RETRY_MULTIPLIER:-2}"

cleanup() {
  if [[ -n "${DETAILS_TEMP_FILE}" && -f "${DETAILS_TEMP_FILE}" ]]; then
    rm -f "${DETAILS_TEMP_FILE}"
  fi
}
trap cleanup EXIT

if [[ -z "${DETAILS}" || ! -f "${DETAILS}" ]]; then
  DETAILS_TEMP_FILE="$(mktemp)"
  printf '%s\n' "${DEFAULT_DETAILS}" >"${DETAILS_TEMP_FILE}"
  DETAILS="${DETAILS_TEMP_FILE}"
fi

# Check folder
if [[ ! -d "$FOLDER" ]]; then
  echo "Folder does not exist: $FOLDER"
  exit 1
fi

echo "Searching videos in: $FOLDER"

FILES=()
while IFS= read -r -d '' file; do
  FILES+=("$file")
done < <(find "$FOLDER" -maxdepth 1 -type f \( -iname '*.mp4' -o -iname '*.mov' \) -print0)

echo "Found ${#FILES[@]} files"

previous_video_id=""
FAILED_FILES=()

for i in "${!FILES[@]}"; do
  file="${FILES[$i]}"
  filename=$(basename "$file")
  desc="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed lacinia ipsum erat, sed luctus velit ultrices vel. Nullam lobortis tristique accumsan."

  echo ""
  echo "[$((i + 1))/${#FILES[@]}] Uploading: $filename"

  attempt=0
  success=false
  last_error=""

  while [[ $attempt -lt $MAX_RETRIES ]]; do
    attempt=$((attempt + 1))
    echo "  Attempt $attempt/$MAX_RETRIES..."

    curl_cmd=(
      curl -X POST "$UPLOAD_URL"
      -F "file=@$file"
      -F "video-name=$filename"
      -F "description=$desc"
      -F "relative-path=$filename"
      -sS -w $'\nHTTP%{http_code}'
    )

    if [[ -n "${DETAILS}" && -f "${DETAILS}" ]]; then
      curl_cmd+=(-F "details=@${DETAILS};type=application/json")
    fi

    if [[ -n "$previous_video_id" ]]; then
      curl_cmd+=(-F "continuation-of=$previous_video_id")
    fi

    # Execute and capture exit code
    result=""
    if ! result=$("${curl_cmd[@]}"); then
      rc=$?
      last_error="curl exited with code $rc"
      echo "  curl failed: $last_error"
    else
      http_code="${result##*HTTP}"
      response_body="${result%$'\nHTTP'*}"

      if [[ "$http_code" == "200" ]]; then
        # success
        previous_video_id="$(echo -n "$response_body" | tr -d '\r\n')"
        echo "  $filename OK (id: $previous_video_id)"
        success=true
        break
      else
        last_error="HTTP $http_code"
        echo "  server returned $last_error"
      fi
    fi

    # If not last attempt, sleep with exponential backoff
    if [[ $attempt -lt $MAX_RETRIES ]]; then
      backoff=$((SLEEP_INITIAL * (RETRY_MULTIPLIER ** (attempt - 1))))
      echo "  Waiting ${backoff}s before retry..."
      sleep "$backoff"
    fi
  done

  if ! $success; then
    echo "  Failed to upload $filename after $MAX_RETRIES attempts. Last error: $last_error"
    FAILED_FILES+=("$filename: $last_error")
  fi
done
