# Local media (development)

Optional directory for images or other files kept under the repo `data/` tree. In production, uploads are expected to use object storage (e.g. S3); local paths here are for development only.

To create one **Post** per image here (round-robin across Spring Fiesta challenges), run **`make seed`** from the repo root after `docker compose up`, or `python -m scripts.seed_dev` from `backend/` with `DATABASE_URL` set. Images are read from this folder and **written under `data/uploads/posts/{post_id}/`** like a mobile upload. See `backend/scripts/seed_sample_posts.py`.
