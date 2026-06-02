.PHONY: help dev prod test prod-build dev-build test-build down logs clean full-clean restart-backend

help:
	@echo "Available commands:"
	@echo "  make prod           - Run production environment"
	@echo "  make dev            - Run development environment"
	@echo "  make test           - Run test environment"
	@echo "  make prod-build     - Build prod Docker images"
	@echo "  make dev-build      - Build dev Docker images"
	@echo "  make test-build     - Build test Docker images"
	@echo "  make down           - Stop all containers"
	@echo "  make logs           - Show container logs"
	@echo "  make clean          - Remove containers and volumes"
	@echo "  make full-clean     - Remove containters, volumes and orphans"
	@echo "  restart-backend     - Restart backend container"


prod:
	docker-compose up

dev:
	docker compose -f docker-compose.dev.yml up

test:
	docker compose -f docker-compose.test.yml up --exit-code-from playwright --quiet-build 
	@docker compose -f docker-compose.test.yml down --remove-orphans

prod-build:
	docker compose up --build

dev-build:
	docker compose -f docker-compose.dev.yml up --build

test-build:
	docker compose -f docker-compose.test.yml up --build

down:
	docker-compose down

logs:
	docker-compose logs -f

clean:
	docker-compose -f docker-compose.dev.yml down -v

full-clean:
	docker-compose -f docker-compose.test.yml down -v --remove-orphans

restart-backend:
	docker compose restart backend
