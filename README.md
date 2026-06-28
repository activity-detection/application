<h1 align="center">
Activity Detector
</h1>

<div align="center">
<b>Real-time system for detecting certain activities on CCTV cameras.</b>
</div>

## Containers

Below is a brief explanation of the Docker environments used in the project.

- dev (development)
  - Purpose: fast development with hot-reload, mapping host code into the container, and debugging.
  - Run (example): `docker-compose -f docker-compose.dev.yml up --build`.
  - Notes: unoptimized images; uses volumes and development tools. Saves clips in detector/clips folder.

- prod (production)
  - Purpose: images optimized for deployment.
  - Build (example): `docker-compose -f docker-compose.yml up --build`.

## How to begin

After cloning repository you need to copy file `detector/.env.example` to `detector/.env`. Populate it with correct data. After that start application using Docker Compose file.

If using `MODE=VIDEO` you can select video using SOURCE_PATH variable. (Only dev)

If using `MODE=RTSP` you need to populate RTSP related variables.

## Modules

- Frontend — [frontend/README.md](frontend/README.md)
- Backend — [backend/README.md](backend/README.md)
- Detector — [detector/README.md](detector/README.md)
