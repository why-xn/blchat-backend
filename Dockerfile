FROM node:12.22.6-buster

ENV NODE_ENV=Production
ENV TOKEN_KEY=changeit
ENV PORT=8080
ENV ADMIN_USERNAME=admin
ENV ADMIN_PASSWORD=hello123
ENV MONGODB_AUTH_ENABLED=1
ENV MONGODB_HOST=localhost
ENV MONGODB_PORT=27017
ENV MONGODB_DBNAME=blchat
ENV MONGODB_USERNAME=root
ENV MONGODB_PASSWORD=changeit
ENV REDIS_HOST=localhost
ENV REDIS_PORT=6379

RUN apt-get update && apt-get -y install curl ca-certificates vim && update-ca-certificates

WORKDIR /app
COPY . .

RUN rm -rf .env

RUN npm install

EXPOSE 8080

CMD npm start