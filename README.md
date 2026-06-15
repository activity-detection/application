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
  - Notes: unoptimized images; uses volumes and development tools.

- prod (production)
  - Purpose: images optimized for deployment.
  - Build (example): `docker-compose -f docker-compose.prod.yml up --build`.

- test (tests)
  - Purpose: run tests and CI validation in an isolated environment.
  - Run (example): `docker compose -f docker-compose.test.yml up --build`

## Modules

- Frontend — [frontend/README.md](frontend/README.md)
- Backend — [backend/README.md](backend/README.md)
- Detector — [detector/README.md](detector/README.md)
