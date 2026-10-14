# PharmaInventory - Balanço Autônomo de Farmácias

> SaaS Industrial de Automação de Inventário Farmacêutico com Matrix Scan

[![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-2.39-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps)

## Visão Geral

PharmaInventory substitui equipes terceirizadas de balanço por um software que automatiza a contagem de estoque através de **Captura Passiva (Matrix Scan + Object Counting)**, eliminando o processo manual de "bipar um por um".

### Diferenciais Técnicos

- **Matrix Scan Real**: Detecção de múltiplos códigos de barras em um único frame (30-60 FPS)
- **Clustering Espacial**: Agrupamento inteligente de códigos idênticos por posição (DBSCAN adaptativo)
- **Acumulador Inteligente**: Sugestão automática de quantidade baseada em densidade espacial
- **Zero Capital**: 100% Web (PWA), roda no navegador do celular, sem hardware dedicado
- **Offline-First**: Funciona sem internet, sincroniza automaticamente quando online
- **Integração Nativa**: Supabase (Auth, Database, Realtime, Edge Functions)

## Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + Design System customizado |
| Scanner | BarcodeDetector API (Native) + ZXing WASM (Fallback) |
| Computer Vision | Spatial Clustering Engine (JavaScript) |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| State | Zustand (leve, TypeScript-first) |
| PWA | Workbox + Service Worker customizado |
| Deploy | Vercel / Netlify / Docker |

## Estrutura do Projeto

```
pharma-inventory-saas/
├── public/
│   ├── manifest.webmanifest    # PWA Manifest
│   ├── sw.js                   # Service Worker
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── ScanEngine/         # Motor de escaneamento (Core)
│   │   │   ├── ScanEngine.ts   # Classe principal
│   │   │   ├── useScanEngine.ts # React Hook
│   │   │   └── index.ts
│   │   ├── InventoryUI/        # Interface de usuário
│   │   │   ├── ScannerView.tsx # View da câmera com overlays
│   │   │   ├── DetectionList.tsx # Lista detecções tempo real
│   │   │   ├── AccumulatorPanel.tsx # Painel de contagem
│   │   │   ├── SessionManager.tsx # Gerenciamento sessões
│   │   │   └── index.ts
│   │   ├── SupabaseClient/     # Cliente Supabase
│   │   │   ├── SupabaseClient.ts # Service class
│   │   │   ├── useSupabase.ts  # React Hooks
│   │   │   └── index.ts
│   │   └── common/             # Componentes compartilhados
│   ├── hooks/                  # Custom hooks
│   ├── utils/
│   │   ├── helpers.ts          # Utilitários gerais
│   │   └── spatialClustering.ts # Engine de clustering
│   ├── types/
│   │   └── index.ts            # TypeScript definitions
│   ├── styles/
│   │   └── globals.css         # Tailwind + Design System
│   ├── App.tsx                 # Componente raiz
│   └── main.tsx                # Entry point
├── docs/
│   ├── ARCHITECTURE.md         # Documento de arquitetura técnica
│   ├── BUSINESS_MODEL.md       # Modelo de negócio e GTM
│   └── database-schema.sql     # Schema PostgreSQL/Supabase
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── .env.example
```

## Início Rápido

### Pré-requisitos

- Node.js 18+
- Conta Supabase (gratuita para começar)
- HTTPS (obrigatório para câmera/PWA)

### Instalação

```bash
# Clone e entre no diretório
cd pharma-inventory-saas

# Instale dependências
npm install

# Configure variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais Supabase

# Execute o schema no Supabase SQL Editor
# Copie o conteúdo de docs/database-schema.sql

# Inicie desenvolvimento
npm run dev
```

### Configuração Supabase

1. Crie projeto em [supabase.com](https://supabase.com)
2. Vá em Settings > API e copie:
   - `VITE_SUPABASE_URL` (Project URL)
   - `VITE_SUPABASE_ANON_KEY` (anon/public key)
3. Cole no arquivo `.env`
4. No SQL Editor, execute `docs/database-schema.sql`
5. Em Authentication > Providers, habilite Email/Password

### Build para Produção

```bash
# Type check
npm run type-check

# Lint
npm run lint

# Build otimizado
npm run build

# Preview local do build
npm run preview
```

## Funcionalidades Principais

### 1. Scanner Matrix Scan
- Loop contínuo de captura (não para no primeiro código)
- ROI configurável (Região de Interesse)
- Overlay visual de detecções em tempo real
- Suporte a EAN-13, EAN-8, UPC-A, UPC-E, Code-128, QR, DataMatrix, PDF417

### 2. Detecção em Tempo Real
- Lista todos os códigos capturados no frame atual
- Agrupamento espacial automático (clusters)
- Indicador de estabilidade (frames consecutivos)
- Confiança por detecção

### 3. Acumulador de Quantidades
- Contagem automática por GTIN
- Extrapolação baseada em densidade espacial
- Sugestão de quantidade para confirmação
- Comparação com estoque do sistema (divergência %)

### 4. Sincronização de Auditoria
- Consulta Supabase em tempo real
- Alerta de divergência (quantidade, validade, lote)
- Log imutável de todas as operações
- Export PDF/CSV para auditoria fiscal

### 5. Gestão Multi-Loja
- Múltiplas farmácias por conta
- Roles: Admin, Manager, Operator, Auditor
- Configurações por loja (alertas, modos de scan)

## Documentação

- [Arquitetura Técnica](docs/ARCHITECTURE.md) - Pipeline de visão, ML stack, database schema
- [Modelo de Negócio](docs/BUSINESS_MODEL.md) - Pricing, GTM, roadmap 3 fases
- [Database Schema](docs/database-schema.sql) - SQL pronto para Supabase

## Roadmap

### Fase 1: MVP (Atual) - Web PWA
- ✅ Matrix Scan via BarcodeDetector/ZXing
- ✅ Spatial Clustering JS
- ✅ Supabase Integration
- ✅ PWA Offline-First

### Fase 2: Beta (Q2 2025) - App Nativo + ML
- 🔄 React Native / Expo
- 🔄 YOLOv8n para detecção de caixas
- 🔄 TensorFlow Lite / Core ML
- 🔄 OCR Lote/Validade

### Fase 3: Enterprise (Q4 2025) - Ecossistema
- 📋 Integração ERPs (Linx, TOTVS, Senior)
- 📋 Marketplace de Dados Anonimizados
- 📋 Whitelabel / SDK para ERPs

## Contribuição

```bash
# Fork o projeto
# Crie branch: git checkout -b feature/nova-funcionalidade
# Commit: git commit -m 'feat: adiciona nova funcionalidade'
# Push: git push origin feature/nova-funcionalidade
# Abra Pull Request
```

## Licença

Proprietário - PharmaInventory SaaS. Todos os direitos reservados.

## Contato

- **Website**: [pharma-inventory.com](https://pharma-inventory.com)
- **Email**: contato@pharma-inventory.com
- **LinkedIn**: [PharmaInventory](https://linkedin.com/company/pharma-inventory)

---

*Desenvolvido com ❤️ para transformar a gestão de estoque farmacêutico no Brasil*