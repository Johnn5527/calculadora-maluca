<div align="center">

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&height=200&color=0:050505,50:6d28d9,100:a855f7&text=CALCULADORA%20MALUCA&fontSize=50&fontColor=ffffff&animation=fadeIn&fontAlignY=35"/>

<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=700&size=20&duration=2500&pause=800&color=C084FC&center=true&vCenter=true&width=700&lines=APERTOU+%22%3D%22%3F;HORA+DO+MINIJOGO+RETR%C3%94+%F0%9F%8D%84;MATEM%C3%81TICA+%2B+DIVERS%C3%83O"/>

<img src="https://img.shields.io/badge/JavaScript-8A2BE2?style=for-the-badge&logo=javascript&logoColor=white"/>
<img src="https://img.shields.io/badge/Node.js-Fastify-6d28d9?style=for-the-badge&logo=node.js&logoColor=white"/>
<img src="https://img.shields.io/badge/PostgreSQL-a855f7?style=for-the-badge&logo=postgresql&logoColor=white"/>
<img src="https://img.shields.io/badge/PWA-8A2BE2?style=for-the-badge&logo=pwa&logoColor=white"/>

</div>

---

## 🍄 Sobre

Uma calculadora web em que **cada "=" vira um minijogo de plataforma retrô**. Você faz a conta, joga, ganha XP, sobe de nível e entra no ranking.

```bash
╭────────────────────────────────╮
│    CALCULADORA MALUCA v3.0     │
╰────────────────────────────────╯

✔ Motor matemático próprio (parser + engine)
✔ 9 minijogos retrô
✔ XP, níveis, missões e conquistas
✔ Ranking online com API segura
✔ Funciona offline (PWA)

STATUS: PRONTO PARA JOGAR 🎮
```

## 🎮 Minijogos

| | | |
|---|---|---|
| 🧱 Bloco Duplicador | 🟢 Cano Subterrâneo | 👾 Chefão |
| 🪙 Chuva de Moedas | 🚩 Corta Bandeira | 🐉 Dragão Devorador |
| ⭐ Estrela Turbo | 👟 Pisa-Pisa | 🎰 Roleta dos Cogumelos |

## 🧩 Arquitetura

```text
calculadora-maluca/
├── index.html, css/, js/     → app web (PWA, sem framework)
│   ├── js/math/              → parser e motor de cálculo próprios
│   └── js/games/             → minijogos
├── server/                   → API do ranking (Node.js + Fastify + PostgreSQL)
│   ├── migrations/           → schema versionado
│   └── test/                 → testes da API
├── backend/                  → versão antiga da API em Java (Spring Boot)
├── tests/                    → testes do motor matemático
└── Dockerfile                → imagem da API
```

## 🔐 Segurança

- Tokens aleatórios de 32 bytes guardados só como **hash HMAC com pepper**
- Partidas assinadas com HMAC e checagem de **plausibilidade** da pontuação
- **Limite por IP**, cabeçalhos de segurança (Helmet) e CORS com origens exatas
- Apelidos filtrados e **consentimento do responsável** para crianças
- Nenhum segredo no código: tudo vem de variáveis de ambiente (`server/.env.example`)

## ⚡ Como rodar

```bash
# App
npm start                 # http://localhost:5173
npm test                  # testes do motor matemático

# API do ranking
cd server
cp .env.example .env      # preencha os segredos (veja as instruções no arquivo)
npm install
npm run migrate
npm run dev
npm test
```

---

<div align="center">

Feito com 💜 por **[Johnny Lucas](https://github.com/Johnn5527)**

</div>

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&height=120&section=footer&color=0:050505,50:6d28d9,100:a855f7"/>
