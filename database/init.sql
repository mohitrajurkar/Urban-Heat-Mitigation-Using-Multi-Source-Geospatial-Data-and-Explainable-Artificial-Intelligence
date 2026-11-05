-- Executed once by the postgis/postgis container on first start (docker-entrypoint-initdb.d).
-- Tables are created by Flyway migrations (database/migrations) when the backend starts.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
SELECT postgis_full_version();
