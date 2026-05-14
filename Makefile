# Kids Food Fight — local dev helpers (run from repo root)

.PHONY: seed dev

seed:
	docker compose run --rm backend python -m scripts.seed_dev

dev:
	./scripts/run
