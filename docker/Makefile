.PHONY: help dev prod build down logs clean total-clean

help:
	@echo "Available commands:"
	@echo "  make prod           - Run production environment"
	@echo "  make dev  		     - Run development environment"
	@echo "  make build          - Build Docker images"
	@echo "  make down           - Stop all containers"
	@echo "  make logs           - Show container logs"
	@echo "  make clean          - Remove containers and volumes"
	@echo "  make total-clean   - Remove containers and built Docker images"

prod:
	docker-compose up

dev:
	docker-compose -f docker-compose.dev.yml up

prod-build:
	docker compose up --build

dev-build:
	docker compose -f docker-compose.dev.yml up --build

down:
	docker-compose down

logs:
	docker-compose logs -f

clean:
	docker-compose -f docker-compose.dev.yml down -v

total-clean:
	docker-compose down --rmi all --remove-orphans --timeout 30

restart-backend:
	docker compose restart backend