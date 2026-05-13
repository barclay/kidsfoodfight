# Kids Food Fight — local dev helpers (run from repo root)

.PHONY: seed
seed:
	docker compose run --rm backend python -m scripts.seed_dev
