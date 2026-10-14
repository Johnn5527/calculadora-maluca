# API do ranking da Calculadora Maluca.
# Contexto = raiz do projeto, porque o servidor importa as regras do app (js/).
#   docker build -t calculadora-maluca-api .
#   docker run --env-file server/.env.producao -p 8787:8787 calculadora-maluca-api
# Migrations são um passo separado do deploy (a API não sobe com o banco desatualizado):
#   docker run --rm --env-file server/.env.producao calculadora-maluca-api npm run migrate

FROM node:24-alpine

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787

WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server/src ./src
COPY server/migrations ./migrations
# só os módulos de regra que o servidor usa (nada de HTML, CSS ou testes)
COPY js /app/js

USER node
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/v1/saude" >/dev/null || exit 1

CMD ["node", "src/index.js"]
