--- Stage 1: Build the React Application ---

FROM node:18-alpine AS build

Set the working directory

WORKDIR /app

Copy package.json and package-lock.json (if available)

COPY package*.json ./

Install dependencies

RUN npm install

Copy the rest of the application code

COPY . .

NOTE: Set the API URL environment variable for the build stage.

The URL "http://backend:5000" uses the service name defined in docker-compose.yml.

If your backend uses port 80 or similar, adjust the port.

ENV REACT_APP_API_URL=http://backend:5000

Build the React application

RUN npm run build

--- Stage 2: Serve the Application using Nginx ---

FROM nginx:stable-alpine

Copy the built files from the previous stage to the Nginx public directory

COPY --from=build /app/build /usr/share/nginx/html

Copy a custom Nginx configuration to enable history mode routing (optional but recommended for React)

and proxy requests to the backend (to be configured in docker-compose, this is placeholder)

COPY nginx.conf /etc/nginx/conf.d/default.conf

Expose the port Nginx is running on (default is 80)

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]