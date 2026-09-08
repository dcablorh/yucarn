# syntax=docker/dockerfile:1

# The stock image, plus one startup step: set the role's password to
# POSTGRES_PASSWORD on every boot. Stock Postgres reads POSTGRES_PASSWORD only
# when the data volume is first created, so changing it in the deployment's
# environment afterwards leaves the database and the server disagreeing (P1000).
FROM postgres:17-alpine

COPY --chmod=755 sync-credentials.sh /usr/local/bin/sync-credentials.sh

# STOPSIGNAL (SIGINT, fast shutdown) is inherited from the base image and
# forwarded to postgres by the script.
ENTRYPOINT ["sync-credentials.sh"]
CMD ["postgres"]
