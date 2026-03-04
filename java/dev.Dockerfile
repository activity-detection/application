FROM maven:3.9.6-eclipse-temurin-21 AS dev
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
RUN mkdir -p /app/videos
CMD ["mvn", "spring-boot:run", "-Dspring-boot.run.profiles=docker", "-Dspring-boot.run.fork=false"]