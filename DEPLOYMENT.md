  curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh
  sudo usermod -aG docker "$USER"
  # then log out/in or run `newgrp docker`
  ```
- Git (usually present). If repo is private and you use SSH, have your SSH key added to GitHub.

1) SSH into your VM
```bash
ssh YOUR_USER@YOUR_VM_IP
```

2) Clone the repo (pick one)
- SSH (private repo):
```bash
git clone git@github.com:ai-final-proj/n8n-transformers.git ~/n8n-transformers
```
- HTTPS (public repo):
```bash
git clone https://github.com/ai-final-proj/n8n-transformers.git ~/n8n-transformers
```

3) Create runtime env file (fill with your real DB secret; example uses your Neon DSN)
```bash
cat > ~/n8n-transformers/app.env <<'EOF'
DATABASE_URL="postgresql+psycopg://neondb_owner:npg_MPZ3lB5RtSve@ep-green-truth-adedoaj5-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
SECRET_KEY="replace-with-random-secret"
PORT=7860
FLASK_ENV=production
# add any other env vars your app expects
EOF
chmod 600 ~/n8n-transformers/app.env
```

4) Build the Docker image (from repo root)
```bash
cd ~/n8n-transformers
docker build -t yourhubuser/n8n-transformers:latest .
# or if you just want local image tag:
docker build -t n8n-transformers:latest .
```

5) Run the container persistently (map host port 80 → container 7860)
```bash
# stop old container (safe)
docker rm -f n8n_app 2>/dev/null || true

# run detached with restart policy
docker run -d \
  --restart unless-stopped \
  --name n8n_app \
  -p 80:7860 \
  --env-file ~/n8n-transformers/app.env \
  n8n-transformers:latest
```

6) Watch logs / health check
```bash
docker logs -f n8n_app
# from your laptop:
curl -i http://YOUR_VM_IP/_healthz
curl -i http://YOUR_VM_IP/api/users/?page=1&size=20
```

7) (If DB schema is missing) seed the DB
- Option A: use psql client on VM (install `postgresql-client` if needed):
```bash
sudo apt-get update && sudo apt-get install -y postgresql-client
PSQL_DSN='postgresql://user:pass@host:5432/dbname'   # or use $DATABASE_URL if exported
psql "$PSQL_DSN" -f ~/n8n-transformers/backend/database/schema_seed.sql
```
- Option B: use Dockerized psql (no client install):
```bash
cd ~/n8n-transformers
docker run --rm -v "$PWD":/work -w /work postgres:15 psql "$DATABASE_URL" -f backend/database/schema_seed.sql
```

8) (Firewall) ensure GCP allows your port
- Open port 80 (or 7860) in GCP Console → VPC network → Firewall rules, or via Cloud Shell:
```bash
gcloud compute firewall-rules create allow-app-http --allow tcp:80
```
(If you get permission errors, create the rule in the Console or use Cloud Shell with your account.)

9) Optional: set up auto-deploy (GitHub Actions)
- If you want CI so pushes auto-deploy, I can add a workflow that SSHes to the VM and runs the build/pull/run above (requires `SSH_PRIVATE_KEY`, `VM_USER`, `VM_HOST` as repo secrets). Tell me and I’ll produce the workflow file.

If you want, I can now:
- produce the exact `docker run` you should run (I used `n8n-transformers:latest` above—replace with your tag), or
- add a tiny `deploy.sh` script you can run on the VM to automate steps 4–6.

Which do you want me to create next?