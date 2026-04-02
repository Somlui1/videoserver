FROM node:20-alpine

# Install ffmpeg in the image
RUN apk add --no-cache ffmpeg bash

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

# Start command will be overridden by docker-compose for worker
CMD ["npm", "start"]
