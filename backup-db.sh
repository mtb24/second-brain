#!/bin/bash
set -e
BACKUP_DIR=/home/brain/brain/backups
mkdir -p $BACKUP_DIR
FILENAME="brain-db-$(date +%Y%m%d-%H%M%S).sql.gz"
docker exec brain-db pg_dump -U brain brain | gzip > $BACKUP_DIR/$FILENAME
ls -t $BACKUP_DIR/*.sql.gz | tail -n +8 | xargs -r rm
echo "Backup complete: $FILENAME"
