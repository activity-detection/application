FROM maven:3.9.6-eclipse-temurin-21 AS builder
WORKDIR /app

COPY pom.xml .
COPY src ./src
#Na razie skip tests potem to zmienic
RUN mvn clean package -DskipTests

#Runner do uruchamiania po zbudowaniu
FROM eclipse-temurin:21-jdk-alpine
WORKDIR /app
RUN apk add --no-cache ffmpeg
RUN mkdir -p /app/videos
#Skopiowanie wyniku buildera
COPY --from=builder /app/target/*.jar app.jar
#Profil konfiguracji, bo się zmienia względny adres hosta kiedy backend w kontenerze vs lokalnie
ENV SPRING_PROFILES_ACTIVE=docker
EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]