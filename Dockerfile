FROM node:12.22.6-buster

ENV NODE_ENV=Production

WORKDIR /app
COPY . .

RUN npm install

CMD npm start