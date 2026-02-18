# Dashboard Clientes BF

Dashboard de gerenciamento e análise de leads para a BF Labs AI. O sistema permite visualizar métricas de campanhas (Meta Ads, Google Ads), gerenciar leads, clientes e usuários.

## 🚀 Tecnologias

- **Frontend:** [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Linguagem:** [TypeScript](https://www.typescriptlang.org/)
- **Estilização:** [Tailwind CSS](https://tailwindcss.com/)
- **Backend/BaaS:** [Supabase](https://supabase.com/)
- **Gerenciamento de Estado:** [Zustand](https://github.com/pmndrs/zustand)
- **Rotas:** [React Router Dom](https://reactrouter.com/)
- **Ícones:** [Lucide React](https://lucide.dev/)

## ✨ Funcionalidades

- **Dashboard Geral:** Visão consolidada de leads, vendas e performance.
- **Relatório de Leads:** Análise detalhada de origens de tráfego e conversão.
- **Integração com Meta e Google Ads:** Visualização de métricas de campanhas especificas.
- **Gestão de Clientes:** Seleção e administração de diferentes clientes/contas.
- **Gestão de Usuários:** Controle de acesso baseada em funções (Admin, Super Admin).
- **Conexão WhatsApp:** Integração para disparos e atendimento.

## 🛠️ Instalação e Execução

### Pré-requisitos

- Node.js (versão 18 ou superior)
- pnpm (recomendado) ou npm

### Passos

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/BFLabsAI/dashboard-clientes-bf.git
   cd dashboard-clientes-bf
   ```

2. **Instale as dependências:**
   ```bash
   pnpm install
   # ou
   npm install
   ```

3. **Configuração de Variáveis de Ambiente:**
   Crie um arquivo `.env` na raiz do projeto com as chaves do Supabase:

   ```env
   VITE_SUPABASE_URL=sua_url_supabase
   VITE_SUPABASE_ANON_KEY=sua_chave_anonima
   ```

4. **Inicie o servidor de desenvolvimento:**
   ```bash
   pnpm dev
   # ou
   npm run dev
   ```

## 📦 Scripts Disponíveis

- `pnpm dev`: Inicia o servidor local.
- `pnpm build`: Compila o projeto para produção.
- `pnpm lint`: Executa a verificação de código com ESLint.
- `pnpm preview`: Visualiza o build de produção localmente.
