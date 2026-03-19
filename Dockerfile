FROM node:22.12-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

EXPOSE 8080
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "DATABASE_URL=${DIRECT_URL:-$DATABASE_URL} npx prisma migrate deploy && npm start"]
