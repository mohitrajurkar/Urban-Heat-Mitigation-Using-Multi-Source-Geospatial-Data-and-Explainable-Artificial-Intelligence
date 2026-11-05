# Build context is the repository root (see docker-compose.yml) so that the
# Flyway migrations in database/migrations are packaged into the jar.
FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /workspace/backend
COPY backend/pom.xml .
RUN mvn -q -B dependency:go-offline
COPY backend/src ./src
COPY database/migrations /workspace/database/migrations
RUN mvn -q -B package -DskipTests

FROM eclipse-temurin:17-jre-jammy
RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 1001 spring
WORKDIR /app
COPY --from=build /workspace/backend/target/urban-heat-backend-1.0.0.jar app.jar
USER spring
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
