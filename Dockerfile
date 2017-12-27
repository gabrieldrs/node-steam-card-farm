# The base docker, this comes from dockerhub with os and node out of the box
FROM node:6-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json .

RUN npm install

# Bundle app source
COPY . .

# Expose docker port
#EXPOSE 8080

# After copying everything, the docker will run this command on bash, starting the application
CMD export $(cat .env | xargs) && node index.js