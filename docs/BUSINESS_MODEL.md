# PharmaInventory - Modelo de Negócio e Go-to-Market

## 1. Proposta de Valor (Value Proposition)

### 1.1 Problema Atual do Mercado

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DOR DO DONO DE FARMÁCIA                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ⏱️  TEMPO:  8-16 horas de portas fechadas por balanço                     │
│  💰  CUSTO:  R$ 3.000-8.000 por balanço (equipe terceirizada)             │
│  ❌  ERRO:   3-8% de divergência (contagem manual "bip-a-bip")            │
│  📅  FREQ:   Mensal/Trimestral obrigatório (ANVISA/Sefaz)                 │
│  😰  RISCO:  Multas, perda de licença, rupturas de estoque                │
│                                                                             │
│  "Fecho a loja no domingo, pago equipe externa, e ainda                  │
│   tenho que conferir tudo de novo na segunda."                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Nossa Solução: "Balanço Autônomo"

| Métrica | Processo Tradicional | PharmaInventory | Melhoria |
|---------|---------------------|-----------------|----------|
| **Tempo de balanço** | 8-16h | 45-90 min | **85-90% redução** |
| **Custo direto** | R$ 3-8k | R$ 150-400/mês | **95% redução** |
| **Precisão** | 92-97% | 99.5%+ | **Elimina recontagem** |
| **Frequência** | Mensal | Semanal/Diário | **Gestão contínua** |
| **Validade** | Manual | Automática (lote+data) | **Zero vencidos** |
| **Auditoria** | Papel/Planilha | Digital/Blockchain-ready | **Compliance total** |

### 1.3 Pitch de Elevator (30 segundos)

> **"PharmaInventory transforma o balanço de estoque de um evento traumático mensal de 12 horas em um processo contínuo de 45 minutos. Usando Matrix Scan - a mesma tecnologia dos centros de distribuição da Amazon - seu farmacêutico aponta o celular para a prateleira e o software conta, identifica, verifica validade e concilia com o ERP em tempo real. Zero capital, zero hardware, instala em 5 minutos via navegador."**

## 2. Modelo de Precificação (Pricing Strategy)

### 2.1 Estrutura de Planos

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           PLANOS PHARMAINVENTORY                                │
├──────────────────┬──────────────────┬──────────────────┬──────────────────────┤
│     STARTER      │   PROFESSIONAL   │    ENTERPRISE    │    NETWORK/REDE      │
├──────────────────┼──────────────────┼──────────────────┼──────────────────────┤
│  💰 R$ 199/mês   │  💰 R$ 499/mês   │  💰 R$ 1.299/mês │  💰 R$ 99/loja/mês   │
│  (R$ 1.990/ano)  │  (R$ 4.990/ano)  │  (R$ 12.990/ano) │  (mín. 10 lojas)     │
├──────────────────┼──────────────────┼──────────────────┼──────────────────────┤
│ ✓ 1 loja         │ ✓ 3 lojas        │ ✓ 10 lojas       │ ✓ 10+ lojas          │
│ ✓ 5.000 scans/mês│ ✓ 25.000 scans/mês│ ✓ 100.000 scans/mês│ ✓ Ilimitado        │
│ ✓ 1 usuário      │ ✓ 5 usuários     │ ✓ 20 usuários    │ ✓ Usuários ilimitados│
│ ✓ Matrix Scan    │ ✓ Matrix Scan    │ ✓ Matrix Scan    │ ✓ Matrix Scan        │
│ ✓ Alertas valid. │ ✓ Alertas valid. │ ✓ Alertas valid. │ ✓ Alertas valid.     │
│ ✓ Relatórios PDF │ ✓ Dashboard BI   │ ✓ Dashboard BI   │ ✓ Dashboard BI       │
│                  │ ✓ API REST       │ ✓ API REST       │ ✓ API REST           │
│                  │ ✓ Webhooks       │ ✓ Webhooks       │ ✓ Webhooks           │
│                  │                  │ ✓ SSO/SAML       │ ✓ SSO/SAML           │
│                  │                  │ ✓ ERP Integration│ ✓ ERP Integration    │
│                  │                  │ ✓ SLA 99.9%      │ ✓ SLA 99.9%          │
│                  │                  │ ✓ Gerente conta  │ ✓ Gerente conta      │
├──────────────────┼──────────────────┼──────────────────┼──────────────────────┤
│ IDEAL PARA:      │ IDEAL PARA:      │ IDEAL PARA:      │ IDEAL PARA:          │
│ Farmácia única   │ Redes pequenas   │ Redes grandes    │ Associações/         │
│ Manipulação      │ (3-10 lojas)     │ (10+ lojas)      │ Cooperativas         │
│ Drogaria bairro  │ Drogarias regionais│ Atacado/Varejo │ Franquias            │
└──────────────────┴──────────────────┴──────────────────┴──────────────────────┘
```

### 2.2 Métricas de Precificação Baseadas em Valor

```python
# Cálculo do Preço Baseado em ROI do Cliente

def calculate_customer_roi(monthly_revenue: float, stores: int) -> dict:
    """
    Premissas conservadoras:
    - Balanço tradicional: 12h × R$ 50/h × 4 pessoas = R$ 2.400/balanço
    - Frequência: 12x/ano = R$ 28.800/ano
    - Erro 5% = ruptura/perda ~2% faturamento
    - PharmaInventory: 1h × 1 pessoa = R$ 50/balanço = R$ 600/ano
    - Economia direta: R$ 28.200/ano/loja
    """

    traditional_cost_per_year = stores * 28_800
    pharma_cost_per_year = stores * 600  # apenas mão de obra interna
    error_cost = monthly_revenue * 12 * 0.02  # 2% faturamento em rupturas

    annual_savings = traditional_cost_per_year - pharma_cost_per_year + error_cost
    monthly_savings = annual_savings / 12

    # Preço = 15% da economia gerada (regra 15-20% value-based)
    suggested_price = monthly_savings * 0.15

    return {
        "traditional_annual_cost": traditional_cost_per_year,
        "pharma_annual_cost": pharma_cost_per_year,
        "error_cost_annual": error_cost,
        "total_annual_savings": annual_savings,
        "suggested_monthly_price": round(suggested_price, -1),  # arredonda para 10
        "roi_multiple": round(annual_savings / (suggested_price * 12), 1)
    }

# Exemplo: Farmácia fatura R$ 300k/mês, 1 loja
# Economia: R$ 28.200 + R$ 72.000 (rupturas) = R$ 100.200/ano
# Preço sugerido: R$ 1.250/mês → Plano Professional (R$ 499) = 4x mais barato
# ROI para cliente: 16.7x
```

### 2.3 Análise de Sensibilidade de Preço

| Faturamento Loja | Economia Anual | Preço Sugerido (15%) | Plano Recomendado | ROI Cliente |
|-----------------|----------------|----------------------|-------------------|-------------|
| R$ 100k/mês     | R$ 36k         | R$ 450/mês           | Professional      | 6.7x        |
| R$ 300k/mês     | R$ 100k        | R$ 1.250/mês         | Professional      | 16.7x       |
| R$ 1M/mês       | R$ 320k        | R$ 4.000/mês         | Enterprise        | 6.7x        |
| Rede 10 lojas (R$ 300k cada) | R$ 1M | R$ 12.500/mês | Network (R$ 990/mês) | 84x |

### 2.4 Estratégia de Upsell

```
FUNIL DE EXPANSÃO DE RECEITA POR CLIENTE

Mês 1-3:     Starter (R$ 199)  → Onboarding, primeiro balanço
Mês 4-6:     Professional      → 2ª loja, integração ERP, usuários extras
Mês 7-12:    Enterprise        → Rede completa, API, SLA, customizações
Ano 2+:      Network/White-label→ Associação, franquia, marketplace

LTV Estimado (3 anos):
- Farmácia única:     R$ 7.200  (Starter → Professional)
- Rede 5 lojas:       R$ 45.000 (Professional → Enterprise)
- Rede 20 lojas:      R$ 180.000 (Enterprise → Network)
- Associação 50+:     R$ 500.000+ (Network + Whitelabel)
```

## 3. Roadmap de 3 Fases

### 3.1 Fase 1: MVP - Web App PWA (Meses 1-4) ✅ EM DESENVOLVIMENTO

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FASE 1: MVP (WEB PWA)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  OBJETIVO: Validar product-market fit com 10 farmácias piloto              │
│                                                                             │
│  ENTREGÁVEIS TÉCNICOS:                                                      │
│  ✅ Matrix Scan via BarcodeDetector API + ZXing fallback                   │
│  ✅ Spatial Clustering (DBSCAN adaptativo em JS)                           │
│  ✅ Acumulador inteligente com sugestão de quantidade                      │
│  ✅ Integração Supabase (Auth, DB, Realtime, Storage)                      │
│  ✅ PWA instalável (offline-first, service worker)                         │
│  ✅ Multi-loja, multi-usuário, roles (RBAC)                                │
│  ✅ Alertas de validade (lote + data)                                      │
│  ✅ Logs de divergência com severidade                                     │
│  ✅ Export PDF/CSV para auditoria                                          │
│                                                                             │
│  MÉTRICAS DE SUCESSO:                                                       │
│  • 10 farmácias ativas piloto                                              │
│  • NPS ≥ 50                                                                │
│  • Tempo médio balanço < 90 min                                            │
│  • Precisão contagem ≥ 95%                                                 │
│  • Zero data loss offline                                                  │
│                                                                             │
│  INVESTIMENTO: R$ 150k (dev) + R$ 30k (infra/mês)                          │
│  BREAKEVEN: 8 clientes Professional                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Sprint Plan Fase 1

| Sprint | Foco | Entregas | Duração |
|--------|------|----------|---------|
| 1-2 | Core Scanner | Camera + BarcodeDetector + ZXing fallback | 2 semanas |
| 3-4 | Spatial Clustering | DBSCAN adaptativo + Accumulator | 2 semanas |
| 5-6 | Supabase Integration | Auth, CRUD, Realtime, Offline Queue | 2 semanas |
| 7-8 | Inventory UI | ScannerView, DetectionList, AccumulatorPanel | 2 semanas |
| 9-10 | Session Management | Multi-store, roles, history, export | 2 semanas |
| 11-12 | Polish & Pilot | PWA, performance, docs, onboarding | 2 semanas |

### 3.2 Fase 2: Beta - App Nativo com ML Local (Meses 5-10)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FASE 2: BETA (NATIVE + ML)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  OBJETIVO: 100 farmácias pagantes, precisão 99%+, contagem visual de caixas │
│                                                                             │
│  TECNOLOGIAS NOVAS:                                                         │
│  📱 React Native / Expo (iOS + Android)                                    │
│  🤖 TensorFlow Lite / Core ML / ML Kit                                     │
│  📦 YOLOv8n para detecção de caixas/embalagens                            │
│  🎯 ByteTrack para tracking e contagem única                               │
│  🔒 Secure Enclave / Keystore para dados sensíveis                         │
│                                                                             │
│  FUNCIONALIDADES CHAVE:                                                     │
│  ✅ Contagem visual de caixas (não só códigos)                             │
│  ✅ OCR de lote/validade na própria caixa                                  │
│  ✅ Funcionamento 100% offline (modelo no device)                          │
│  ✅ Sincronização background inteligente                                   │
│  ✅ Haptic feedback otimizado                                              │
│  ✅ Modo "walkthrough" guiado por voz                                      │
│  ✅ Integração nativa com câmera (controles manuais)                       │
│  ✅ Relatórios fotográficos (evidência)                                    │
│                                                                             │
│  ARQUITETURA ML:                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  FRAME (Camera2 API / AVFoundation)                                 │   │
│  │       │                                                              │   │
│  │       ▼                                                              │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │   │
│  │  │  YOLOv8n    │───▶│  ByteTrack  │───▶│  Contador   │             │   │
│  │  │  (Boxes)    │    │  (Tracking) │    │  Único      │             │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘             │   │
│  │       │                                                              │   │
│  │       ▼                                                              │   │
│  │  ┌─────────────┐    ┌─────────────┐                                 │   │
│  │  │  ML Kit     │───▶│  Fusion     │                                 │   │
│  │  │  Barcode    │    │  Engine     │                                 │   │
│  │  └─────────────┘    └─────────────┘                                 │   │
│  │       │                      │                                      │   │
│  │       ▼                      ▼                                      │   │
│  │  ┌─────────────────────────────────────┐                            │   │
│  │  │         RESULTADO FINAL             │                            │   │
│  │  │  GTIN + QTD + LOTE + VALIDADE + XY  │                            │   │
│  │  └─────────────────────────────────────┘                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  MÉTRICAS DE SUCESSO:                                                       │
│  • 100 clientes pagantes (MRR R$ 50k+)                                     │
│  • Precisão contagem visual ≥ 99%                                          │
│  • Latência inferência < 50ms (mid-range phone)                            │
│  • Crash-free sessions > 99.5%                                             │
│  • App Store rating ≥ 4.7                                                  │
│                                                                             │
│  INVESTIMENTO: R$ 500k (dev + ML) + R$ 100k/mês (infra)                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Modelo ML - Detalhes Técnicos Fase 2

```yaml
# Modelo: YOLOv8n-custom (PharmaBoxes)
model_spec:
  architecture: YOLOv8n (nano)
  input_size: 640x640
  classes:
    - caixa_medicamento
    - frasco_ampola
    - blister
    - bisnaga_tubo
    - embalagem_secundaria
    - display_gondola
  training_data:
    - 50k imagens anotadas (farmácias reais)
    - Augmentation: iluminação, rotação, oclusão, blur, ruído
    - Hard negative mining: prateleiras vazias, mãos, reflexos
  performance_target:
    mAP@0.5: > 0.94
    mAP@0.5:0.95: > 0.65
    latency_p95: < 30ms (Snapdragon 778G / A14)
    model_size: < 6MB (INT8 quantized)
  deployment:
    format: TensorFlow Lite (Android) / Core ML (iOS)
    quantization: INT8 post-training
    accelerator: GPU Delegate / Neural Engine
```

### 3.3 Fase 3: Enterprise - Integração Total ERP (Meses 11-18)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       FASE 3: ENTERPRISE (ECOSYSTEM)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  OBJETIVO: 1.000+ lojas, integração nativa ERPs, marketplace de dados      │
│                                                                             │
│  INTEGRAÇÕES ERP NATIVAS:                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  BRASIL                                                             │   │
│  │  ✅ Linx (Sintegra, Pharma, Farma)                                 │   │
│  │  ✅ TOTVS (RM, Protheus, Fluig)                                    │   │
│  │  ✅ Senior (Pharma, Gestão)                                        │   │
│  │  ✅ Sankhya                                                        │   │
│  │  ✅ Bling / Tiny (pequenas)                                        │   │
│  │  ✅ ContaAzul                                                      │   │
│  │  ✅ API Aberta (webhooks + REST) para ERPs customizados            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  FLUXO DE INTEGRAÇÃO:                                                       │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐    │
│  │  PHARMA     │   │  MIDDLEWARE │   │   ERP       │   │  FISCO/     │    │
│  │  INVENTORY  │──▶│  (Supabase  │──▶│  INTEGRATION│──▶│  ANVISA     │    │
│  │  (Source)   │   │  Edge Fn)   │   │  (Destino)  │   │  (SPED)     │    │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘    │
│        │                                    │                  │           │
│        ▼                                    ▼                  ▼           │
│  • Itens contados                    • Ajuste estoque        • SPED       │
│  • Divergências                      • Custo médio           • Bloco K    │
│  • Validade/lote                     • Curva ABC            • NF-e       │
│  • Valor financeiro                  • Reposição auto       • Inventário │
│                                                                             │
│  MARKETPLACE DE DADOS (Data as a Service):                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ANONIMIZAÇÃO + AGREGAÇÃO                                           │   │
│  │  • Benchmark de curva ABC por região/categoria                     │   │
│  │  • Índice de rupturas por produto                                  │   │
│  │  • Sazonalidade de validade                                        │   │
│  │  • Preço médio de compra (negociação coletiva)                     │   │
│  │  • Insights para indústria (sell-out real)                         │   │
│  │                                                                     │   │
│  │  RECEITA ADICIONAL: R$ 50-200k/mês (indústria/consultorias)        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  WHITELABEL / OEM:                                                          │
│  • SDK para ERPs embedarem scanner                                         │
│  • API para fabricantes (GS1 Brazil integration)                           │
│  • Portal do auditor (acesso read-only para contadores)                    │
│                                                                             │
│  MÉTRICAS DE SUCESSO:                                                       │
│  • 1.000+ lojas ativas (MRR R$ 500k+)                                      │
│  • 5+ integrações ERP certificadas                                         │
│  • Churn < 3% ao ano                                                       │
│  • NPS ≥ 70                                                                │
│  • Receita Data/Marketplace > 20% do total                                 │
│                                                                             │
│  INVESTIMENTO: R$ 1.5M (dev + parcerias + compliance)                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 4. Go-to-Market Strategy

### 4.1 Canais de Aquisição

| Canal | CAC Estimado | Prazo | Volume | Estratégia |
|-------|--------------|-------|--------|------------|
| **Inbound/Content** | R$ 500 | 3-6 meses | Médio | Blog técnico, cases, SEO "balanço farmácia" |
| **Parcerias ERPs** | R$ 1.500 | 6-12 meses | Alto | Co-selling com Linx, TOTVS, Senior |
| **Eventos/Feiras** | R$ 3.000 | Imediato | Baixo | Abrafarma, Febrafar, Expofarma |
| **Indicação (Referral)** | R$ 200 | Contínuo | Crescente | Programa "Indique e Ganhe" (2 meses grátis) |
| **Outbound (Inside Sales)** | R$ 2.500 | 2-4 meses | Controlado | Lista ABRAFARMA + LinkedIn Sales Nav |
| **Marketplaces** | Revenue Share | 3-6 meses | Médio | VTEX, Mercado Livre, B2W pharmacy |

### 4.2 Funil de Vendas

```
                    ┌─────────────────┐
                    │   VISITANTES    │  10.000/mês (orgânico + pago)
                    │   (Site/LinkedIn)│
                    └────────┬────────┘
                             │ 15% conversão
                             ▼
                    ┌─────────────────┐
                    │   LEADS         │  1.500/mês
                    │   (Demo agendada)│
                    └────────┬────────┘
                             │ 30% conversão
                             ▼
                    ┌─────────────────┐
                    │   TRIAL/PILOTO  │  450/mês (14 dias grátis)
                    │   (PWA instant) │
                    └────────┬────────┘
                             │ 40% conversão
                             ▼
                    ┌─────────────────┐
                    │   CLIENTES      │  180/mês
                    │   (Pagantes)    │
                    └─────────────────┘

METAS MENSAIS:
• Mês 1-3:   10 pilotos → 3 pagantes
• Mês 4-6:   50 trials → 15 pagantes
• Mês 7-12:  200 trials → 80 pagantes
• Ano 2:     500 trials → 250 pagantes
```

### 4.3 Customer Success & Retenção

```
ONBOARDING (Primeiros 30 dias):
├── Dia 1:    Conta criada, loja configurada, primeiro scan
├── Dia 3:    Sessão guiada com CS (30 min vídeo)
├── Dia 7:    Primeiro balanço completo sozinho
├── Dia 14:   Check-in: métricas, dúvidas, otimizações
├── Dia 30:   QBR (Quarterly Business Review) light

HEALTH SCORE (Monitoramento contínuo):
├── Frequência de uso (scans/semana)
├── Taxa de conclusão de balanço
├── Divergências resolvidas vs abertas
├── Features adotadas (API, relatórios, alertas)
├── NPS trimestral
└── Renegociação proativa 60 dias antes do renewal

CHURN PREVENTION:
├── Alerta se 14 dias sem login
├── Campanha "Balanço do mês" automatizada
├── Webinar mensal "Boas práticas"
├── Programa de embaixadores (desconto vitalício)
└── Migração assistida se mudar ERP
```

## 5. Análise Competitiva

### 5.1 Cenário Competitivo

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        POSICIONAMENTO COMPETITIVO                                │
├──────────────────────┬──────────────┬──────────────┬──────────────┬─────────────┤
│   CRITÉRIO           │ PHARMAINV.   │ EQUIPES      │ COLETORES    │ ERPs        │
│                      │ (NOSSO)      │ TERCEIRIZADAS│ DEDICADOS    │ (MÓDULO)    │
├──────────────────────┼──────────────┼──────────────┼──────────────┼─────────────┤
│ CAPEX                │ R$ 0         │ R$ 0         │ R$ 50-200k   │ R$ 0*       │
│ OPEX/MÊS             │ R$ 199-1299  │ R$ 3-8k      │ R$ 2-5k      │ R$ 500-2k   │
│ TEMPO BALANÇO        │ 45-90 min    │ 8-16h        │ 2-4h         │ 4-8h        │
│ PRECISÃO             │ 99.5%+       │ 92-97%       │ 98%          │ 95%         │
│ VALIDADE/LOTE        │ AUTOMÁTICO   │ MANUAL       │ SEMI-AUTO    │ MANUAL      │
│ OFFLINE              │ SIM          │ N/A          │ SIM          │ NÃO         │
│ INTEGRAÇÃO ERP       │ API/WEBHOOK  │ PLANILHA     │ API          │ NATIVA      │
│ ESCALABILIDADE       │ ILIMITADA    │ LIMITADA     │ HARDWARE     │ LICENÇAS    │
│ AUDITORIA            │ DIGITAL/BC   │ PAPEL        │ DIGITAL      │ DIGITAL     │
│ CURVA APRENDIZADO    │ 15 min       │ N/A          │ 2-4h         │ DIAS        │
└──────────────────────┴──────────────┴──────────────┴──────────────┴─────────────┘
* Módulo inventário do ERP geralmente incluso, mas precisa coletor dedicado
```

### 5.2 Vantagens Competitivas Defensíveis (Moats)

1. **Tecnologia Matrix Scan proprietária** - Algoritmo de clustering espacial patenteável
2. **Dados de treino únicos** - 50k+ imagens de farmácias reais (data moat)
3. **Integração profunda ERPs brasileiros** - 2 anos de relacionamento + APIs certificadas
4. **Network effect** - Quanto mais lojas, melhor o benchmark anonimizado
5. **Switching costs** - Histórico de balanços, configurações, integrações
6. **Brand trust** - "O balanço que a ANVISA confia" (certificação futura)

## 6. Projeções Financeiras (3 Anos)

### 6.1 Receita

| Ano | Clientes | MRR | ARR | Crescimento |
|-----|----------|-----|-----|-------------|
| 1   | 120      | R$ 45k | R$ 540k | - |
| 2   | 450      | R$ 180k | R$ 2.16M | 300% |
| 3   | 1.200    | R$ 550k | R$ 6.6M | 205% |

### 6.2 Custos Principais

| Categoria | Ano 1 | Ano 2 | Ano 3 |
|-----------|-------|-------|-------|
| Pessoal (Dev/ML/CS/Sales) | R$ 1.2M | R$ 2.8M | R$ 5.5M |
| Infra (Supabase, Vercel, CDN) | R$ 180k | R$ 600k | R$ 1.5M |
| Marketing/Vendas | R$ 300k | R$ 800k | R$ 1.8M |
| Jurídico/Compliance | R$ 120k | R$ 300k | R$ 600k |
| **Total** | **R$ 1.8M** | **R$ 4.5M** | **R$ 9.4M** |

### 6.3 Unit Economics (Ano 2 - Steady State)

| Métrica | Valor |
|---------|-------|
| **ARPU** (Receita média por cliente/mês) | R$ 400 |
| **CAC** (Custo de aquisição) | R$ 2.000 |
| **LTV** (Lifetime Value, 3 anos) | R$ 14.400 |
| **LTV/CAC** | 7.2x |
| **Payback Period** | 5 meses |
| **Gross Margin** | 85% |
| **Churn Logo** | < 5%/ano |
| **Net Revenue Retention** | 125% |

## 7. Riscos e Mitigação

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **Big Tech entra (Google/Apple)** | Média | Alto | Foco vertical (farmácia), dados proprietários, integrações ERP |
| **ERP bloqueia API** | Baixa | Alto | LGPD portabilidade, parcerias oficiais, middleware próprio |
| **Regulamentação ANVISA muda** | Média | Médio | Compliance built-in, assessoria jurídica contínua |
| **Concorrente copia Matrix Scan** | Alta | Médio | Patente provisória, velocidade de execução, data moat |
| **Adoção lenta (conservadorismo)** | Alta | Médio | Piloto gratuito, cases de ROI, parceria associações |
| **Falta de talentos ML** | Média | Alto | Remote-first, equity, parceria universidade |

## 7. Próximos Passos Imediatos

```
[ ] Semana 1-2: Finalizar MVP técnico (este código)
[ ] Semana 3:   Deploy staging + testes internos
[ ] Semana 4:   Onboard 3 farmácias piloto (network pessoal)
[ ] Semana 5-6: Iterar baseado em feedback (UX, performance)
[ ] Semana 7:   Landing page + pricing público + signup
[ ] Semana 8:   Primeiro cliente pagante (Starter)
[ ] Mês 3:      10 pilotos → Series Seed (R$ 1-2M)
[ ] Mês 4-6:    Contratar: 2 devs, 1 ML, 1 CS, 1 Sales
[ ] Mês 6:      Lançar Fase 2 Beta (React Native + YOLO)
[ ] Mês 12:     100 clientes → Series A (R$ 5-10M)
```

---

*Documento versão 1.0 - Confidencial*
*PharmaInventory SaaS - Balanço Autônomo de Farmácias*