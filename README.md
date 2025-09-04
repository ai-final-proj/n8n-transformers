```shell
# go to the project root (where docker-compose.yml is)
cd /Users/…/FlaskProject/n8n-transformers/

# build images (only needed if you have custom Dockerfiles, otherwise pulls prebuilt images)
docker compose -f docker-compose.yml -f pgadmin_postgres.yml up -d --build

#stop 
docker compose -f docker-compose.yml -f pgadmin_postgres.yml down

#stop wipe volumes
docker compose -f docker-compose.yml -f pgadmin_postgres.yml down -v
```

The following step requires mysql to be installed 

```shell
mysql -u root -p scheduler < schema.sql
```

Install ollama huggingface_hub etc. environments in order to load models 