# PharmaInventory - Documento de Arquitetura Técnica

## 1. Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              PHARMAINVENTORY ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │   SENSOR     │───▶│  EDGE COMPUTE│───▶│  SPATIAL     │───▶│  SYNC        │     │
│  │  (Camera)    │    │  (WASM/JS)   │    │  CLUSTERING  │    │  ENGINE      │     │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘     │
│        │                    │                    │                    │             │
│        ▼                    ▼                    ▼                    ▼             │
│  ┌──────────────────────────────────────────────────────────────────────────────┐  │
│  │                        REACT PWA (Offline-First)                             │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │  │
│  │  │ ScanEngine  │ │ InventoryUI │ │ SupabaseCl. │ │ IndexedDB/Queue     │   │  │
│  │  │ (ZXing/     │ │ (Scanner,   │ │ (Auth, CRUD,│ │ (Offline Ops,       │   │  │
│  │  │  BarcodeDet)│ │  Detection, │ │  Realtime)  │ │  Background Sync)  │   │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────────────┘  │
│                                    │                                                │
│                                    ▼                                                │
│  ┌──────────────────────────────────────────────────────────────────────────────┐  │
│  │                        SUPABASE BACKEND                                      │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │  │
│  │  │ Auth    │ │ Database│ │ Realtime│ │ Storage │ │ Edge    │ │ Functions│   │  │
│  │  │ (JWT)   │ │ (Postgres)│ │ (WS)    │ │ (Files) │ │ (Deno)  │ │ (ML)    │   │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Pipeline de Visão Industrial

### 2.1 Fluxo de Dados: Sensor → Banco de Dados

```
CÂMERA (30-60 FPS)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ CAPTURA DE FRAME                                            │
│ • HTML5 MediaDevices.getUserMedia()                         │
│ • Resolução: 1920x1080 (ideal) / 1280x720 (mínimo)         │
│ • Facing Mode: environment (câmera traseira)                │
│ • Focus: continuous | Exposure: auto | WB: auto             │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ ROI (REGIÃO DE INTERESSE)                                   │
│ • Normalizado: x: 0.1, y: 0.15, w: 0.8, h: 0.7             │
│ • Reduz área de processamento em ~60%                       │
│ • Elimina bordas, mãos, reflexos                            │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ NORMALIZAÇÃO DE PERSPECTIVA (Opcional - Fase 2)             │
│ • Detecção de cantos (Harris/FAST)                          │
│ • Homografia para correção de keystone                      │
│ • Transformação afim para rotação/escala                    │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ DECODIFICAÇÃO MULTI-SÍMBOLO (MATRIX SCAN)                   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ BarcodeDetector API (Chrome 88+, Edge 88+)              │ │
│ │ • Formatos: EAN-13, EAN-8, UPC-A, UPC-E, Code-128,     │ │
│ │   QR, DataMatrix, PDF417, Aztec                         │ │
│ │ • Detecção paralela nativa no browser                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Fallback: ZXing (WASM)                                  │ │
│ │ • Suporte a Safari/Firefox antigos                      │ │
│ │ • Carregamento sob demanda (lazy)                       │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ AGRUPAMENTO ESPACIAL (SPATIAL CLUSTERING)                   │
│ • Algoritmo: DBSCAN adaptativo com raio configurável        │
│ • Chave: GTIN normalizado (14 dígitos)                      │
│ • Métrica: Distância euclidiana em coordenadas normalizadas │
│ • Estabilidade: Requer N frames consecutivos (default: 3)   │
│ • Extrapolação: Contagem baseada em densidade espacial      │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ ACUMULADOR INTELIGENTE                                      │
│ • Map<GTIN, Cluster> com contagem máxima observada          │
│ • Deduplicação por IoU (Intersection over Union > 0.3)      │
│ • Filtro de confiança mínima (default: 0.5)                 │
│ • Máximo de códigos concorrentes: 50                        │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ CONSULTA SUPABASE (Real-time)                               │
│ • Busca por GTIN (índice único store_id + gtin)             │
│ • Comparação: Quantidade Contada vs Sistema                 │
│ • Cálculo de divergência % e impacto financeiro             │
│ • Verificação de validade (lote + data)                     │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ ALERTAS E PERSISTÊNCIA                                      │
│ • Divergência > threshold → Log + Notificação               │
│ • Vencido/Próximo → Alerta de Validade                      │
│ • Offline: IndexedDB queue → Background Sync                │
│ • Confirmação: Usuário valida quantidade sugerida           │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Especificação do Matrix Scan (JavaScript)

```typescript
// Configuração do Motor de Escaneamento
interface ScanEngineConfig {
  targetFPS: 30;                    // Taxa alvo de frames
  maxConcurrentCodes: 50;           // Máximo códigos simultâneos
  minConfidence: 0.5;               // Confiança mínima (0-1)
  spatialClusteringRadius: 0.08;    // Raio de agrupamento (normalizado)
  stabilityFramesRequired: 3;       // Frames para considerar estável
  roi: {
    enabled: true;
    x: 0.1; y: 0.15;                // 10% esquerda, 15% topo
    width: 0.8; height: 0.7;        // 80% largura, 70% altura
    normalized: true;
  };
  perspectiveCorrection: {
    enabled: false;                 // Fase 2: true com ML
    method: 'homography' | 'affine' | 'none';
    cornerDetection: boolean;
  };
  formats: BarcodeFormat[];         // Formatos habilitados
}
```

### 2.3 Algoritmo de Clustering Espacial

```typescript
class SpatialClusteringEngine {
  // DBSCAN adaptativo para códigos de barras
  private clusters: Map<string, SpatialCluster> = new Map();

  processFrame(detections: BarcodeDetection[], width: number, height: number): SpatialCluster[] {
    // 1. Filtrar por confiança e formato
    const valid = detections.filter(d =>
      d.confidence >= this.config.minConfidence &&
      this.config.formats.includes(d.format)
    );

    // 2. Normalizar posições (0-1)
    const normalized = valid.map(d => ({
      ...d,
      normalizedPosition: {
        x: d.position.x / width,
        y: d.position.y / height
      }
    }));

    // 3. Agrupar por GTIN + proximidade espacial
    normalized.forEach(detection => {
      const existingCluster = this.findNearestCluster(detection);
      if (existingCluster && this.sameProduct(existingCluster, detection)) {
        existingCluster.addDetection(detection);
      } else {
        this.createCluster(detection);
      }
    });

    // 4. Calcular estabilidade e contagem estimada
    this.clusters.forEach(cluster => {
      cluster.updateStability();
      cluster.estimateCount(); // Baseado em densidade espacial
    });

    // 5. Limpar clusters obsoletos (>5s sem detecção)
    this.cleanup();

    return Array.from(this.clusters.values());
  }

  private estimateCount(cluster: SpatialCluster): number {
    // Método de densidade: count = detections * (avg_dist / min_dist)
    const positions = cluster.detections.map(d => d.normalizedPosition);
    const distances = this.pairwiseDistances(positions);
    const avgDist = distances.reduce((a,b) => a+b, 0) / distances.length;
    const minDist = Math.min(...distances);

    return Math.round(cluster.detections.length * (avgDist / Math.max(minDist, 0.01)));
  }
}
```

## 3. Stack de ML Sugerida para Evolução

### 3.1 Fase Atual (MVP - JavaScript/WASM)
```
┌────────────────────────────────────────────────────────────┐
│                    MVP STACK                                │
├────────────────────────────────────────────────────────────┤
│  Detecção:     BarcodeDetector API (Native) / ZXing WASM  │
│  Agrupamento:  DBSCAN JavaScript (Custom)                  │
│  Contagem:     Heurística de densidade espacial            │
│  Inferência:   Client-side only (Zero server dependency)   │
└────────────────────────────────────────────────────────────┘
```

### 3.2 Fase Beta (Native App - TensorFlow Lite)
```
┌────────────────────────────────────────────────────────────┐
│                    BETA STACK                               │
├────────────────────────────────────────────────────────────┤
│  Detecção Caixas:  YOLOv8n (640x640) → TensorFlow Lite    │
│  • Classes: box, bottle, blister, ampoule, tube           │
│  • 3.2M params, ~5ms inferência no Snapdragon 778G        │
│                                                            │
│  Detecção Códigos:  BarcodeDetector + ML Kit              │
│  • Firebase ML Kit Barcode Scanning (iOS/Android)         │
│                                                            │
│  Contagem Visual:   YOLO + Tracking (ByteTrack)           │
│  • Conta caixas individuais na prateleira                 │
│  • Resolve oclusão parcial                                 │
└────────────────────────────────────────────────────────────┘
```

### 3.3 Fase Enterprise (Edge ML + Cloud)
```
┌────────────────────────────────────────────────────────────┐
│                   ENTERPRISE STACK                          │
├────────────────────────────────────────────────────────────┤
│  Edge:            ONNX Runtime Web / TensorRT              │
│  • YOLOv8s-seg (segmentação de instância)                  │
│  • SAM (Segment Anything) para máscaras precisas           │
│                                                            │
│  Cloud Training:   PyTorch + MLflow                        │
│  • Fine-tuning por rede de farmácias                       │
│  • Data augmentation: iluminação, ângulo, oclusão          │
│                                                            │
│  Deploy:           Supabase Edge Functions (Deno)          │
│  • Model registry com versionamento                        │
│  • A/B testing de modelos                                  │
│  • Monitoring: drift detection, latency, accuracy          │
└────────────────────────────────────────────────────────────┘
```

### 3.4 Modelos Recomendados por Caso de Uso

| Caso de Uso | Modelo | Input | Latência (Mobile) | Acurácia |
|-------------|--------|-------|-------------------|----------|
| Detecção Códigos | BarcodeDetector API | Frame RGB | <1ms (native) | 99%+ |
| Detecção Caixas | YOLOv8n | 640×640 | 8-15ms | 94% mAP@0.5 |
| Segmentação Prateleira | YOLOv8s-seg | 640×640 | 20-35ms | 91% mAP@0.5 |
| OCR Lote/Validade | PaddleOCR Lite | ROI 320×160 | 15-25ms | 96% |
| Classificação Apresentação | MobileNetV3-Small | 224×224 | 3-5ms | 93% |

## 4. Modelagem do Banco de Dados (Supabase/PostgreSQL)

### 4.1 Diagrama Entidade-Relacionamento

```
┌─────────────┐       ┌─────────────┐       ┌──────────────────┐
│   stores    │       │   users     │       │    products      │
├─────────────┤       ├─────────────┤       ├──────────────────┤
│ id (PK)     │◀──────│ id (PK,FK)  │       │ id (PK)          │
│ name        │       │ email       │       │ store_id (FK)    │
│ cnpj (UK)   │       │ name        │──────▶│ gtin (UK/store)  │
│ address     │       │ role        │       │ name             │
│ settings    │       │ store_ids[] │       │ manufacturer     │
│ is_active   │       │ preferences │       │ unit             │
└─────────────┘       └─────────────┘       │ price/cost       │
                                            │ barcode_formats[]│
                                            └────────┬─────────┘
                                                     │
                    ┌────────────────────────────────┼────────────────────────────────┐
                    ▼                                ▼                                ▼
           ┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
           │inventory_sessions│              │  scanned_items  │              │divergence_logs  │
           ├─────────────────┤              ├─────────────────┤              ├─────────────────┤
           │ id (PK)         │              │ id (PK)         │              │ id (PK)         │
           │ store_id (FK)   │──┐           │ session_id (FK) │◀────┐        │ session_id (FK) │
           │ user_id (FK)    │  │           │ product_id (FK) │     │        │ item_id (FK)    │
           │ status          │  │           │ gtin            │     │        │ type            │
           │ started_at      │  │           │ quantity        │     │        │ severity        │
           │ completed_at    │  │           │ system_qty      │     │        │ expected_qty    │
           │ settings        │  │           │ divergence      │     │        │ actual_qty      │
           │ metadata        │  │           │ status          │     │        │ value_impact    │
           └────────┬────────┘  │           │ detections[]    │     │        │ resolved        │
                    │           │           │ spatial_cluster │     │        └────────┬────────┘
                    │           │           └────────┬────────┘     │                 │
                    │           │                    │              │                 │
                    ▼           ▼                    ▼              ▼                 ▼
           ┌─────────────────────────────────────────────────────────────────────────┐
           │                            expiry_alerts                                │
           ├─────────────────────────────────────────────────────────────────────────┤
           │ id (PK)  │ session_id (FK) │ item_id (FK) │ product_id (FK) │ gtin    │
           │ expiry_date │ days_to_expiry │ quantity │ severity │ acknowledged    │
           └─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Índices Críticos para Performance

```sql
-- Busca ultra-rápida por GTIN durante escaneamento
CREATE UNIQUE INDEX idx_products_store_gtin ON products(store_id, gtin);

-- Sessões ativas por loja
CREATE INDEX idx_sessions_store_status ON inventory_sessions(store_id, status)
WHERE status IN ('in_progress', 'paused');

-- Itens da sessão ordenados por tempo
CREATE INDEX idx_scanned_items_session_time ON scanned_items(session_id, scanned_at DESC);

-- Divergências não resolvidas
CREATE INDEX idx_divergence_unresolved ON divergence_logs(session_id, resolved)
WHERE resolved = FALSE;

-- Alertas de validade críticos
CREATE INDEX idx_expiry_critical ON expiry_alerts(session_id, severity)
WHERE severity IN ('expired', 'critical');
```

### 4.3 Políticas RLS (Row Level Security)

```sql
-- Isolamento por loja: usuário só vê dados de suas lojas
CREATE POLICY store_isolation ON products
  FOR ALL USING (store_id = ANY(
    SELECT store_ids FROM users WHERE id = auth.uid()
  ));

-- Operadores só modificam próprias sessões
CREATE POLICY own_sessions ON inventory_sessions
  FOR UPDATE USING (user_id = auth.uid());

-- Auditores veem tudo da loja
CREATE POLICY auditor_view ON inventory_sessions
  FOR SELECT USING (
    store_id = ANY(
      SELECT store_ids FROM users WHERE id = auth.uid() AND role = 'auditor'
    )
  );
```

## 5. Sincronização Offline-First

### 5.1 Arquitetura de Sync

```
┌─────────────────────────────────────────────────────────────────┐
│                    OFFLINE-FIRST SYNC                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ONLINE                          OFFLINE                        │
│  ┌─────────┐                     ┌─────────┐                   │
│  │  PWA    │                     │  PWA    │                   │
│  │  ┌───┐  │                     │  ┌───┐   │                   │
│  │  │UI │──┼── Mutations ──────▶│  │UI │   │                   │
│  │  └───┘  │                     │  └───┘   │                   │
│  │    │    │                     │    │    │                   │
│  │    ▼    │                     │    ▼    │                   │
│  │  ┌───┐  │                     │  ┌───┐   │                   │
│  │  │API│──┼── Network Error ──▶│  │DB │   │                   │
│  │  └───┘  │                     │  │   │   │                   │
│  │    │    │                     │    │    │                   │
│  │    ▼    │                     │    ▼    │                   │
│  │  ┌───┐  │     ┌─────────┐    │  ┌───┐   │                   │
│  │  │SW │──┼────▶│ Queue   │───▶│  │DB │   │                   │
│  │  └───┘  │     │(IndexDB)│    │  │   │   │                   │
│  └────┬────┘     └────┬────┘    │  └───┘   │                   │
│       │               │         └────┬─────┘                   │
│       │  ┌────────────┴────────────┐  │                       │
│       │  │   BACKGROUND SYNC       │  │                       │
│       │  │   (Service Worker)      │  │                       │
│       │  │   • Retry exponential   │  │                       │
│       │  │   • Conflict resolution │  │                       │
│       │  │   • Priority queue      │  │                       │
│       │  └───────────┬────────────┘  │                       │
│       │              │              │                       │
│       ▼              ▼              ▼                       │
│  ┌─────────┐     ┌─────────┐   ┌─────────┐                  │
│  │Supabase │     │ Supabase│   │Supabase │                  │
│  │  (OK)   │     │ (Retry) │   │ (Sync)  │                  │
│  └─────────┘     └─────────┘   └─────────┘                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Estratégia de Resolução de Conflitos

```typescript
type ConflictResolution = 'server_wins' | 'client_wins' | 'merge' | 'manual';

const conflictStrategies: Record<string, ConflictResolution> = {
  'inventory_sessions': 'server_wins',      // Sessão: servidor vence
  'scanned_items': 'merge',                  // Itens: merge por GTIN + timestamp
  'divergence_logs': 'client_wins',          // Divergências: cliente vence (auditoria)
  'expiry_alerts': 'client_wins',            // Alertas: cliente vence (segurança)
  'products': 'server_wins',                 // Produtos: servidor vence (catálogo)
};
```

## 6. Escalabilidade e Performance

### 6.1 Métricas Alvo

| Métrica | MVP | Beta | Enterprise |
|---------|-----|------|------------|
| FPS Scanner | 30 | 60 | 60 |
| Latência Detecção | <50ms | <20ms | <10ms |
| Precisão Contagem | 85% | 95% | 99% |
| Tempo Sync | <2s | <500ms | <100ms |
| Offline Support | Básico | Completo | Completo + Conflict |
| Lojas Simultâneas | 10 | 100 | 1000+ |
| Itens/Sessão | 5.000 | 50.000 | 500.000+ |

### 6.2 Otimizações Implementadas

1. **Code Splitting**: Chunks separados para vendor, scanner, supabase
2. **Lazy Loading**: ZXing carregado apenas se BarcodeDetector falhar
3. **Web Workers**: Clustering espacial em worker dedicado (próxima versão)
4. **RequestAnimationFrame**: Loop de render sincronizado com display
5. **IndexedDB**: Cache de produtos para busca offline instantânea
6. **Supabase Realtime**: Subscriptions apenas para sessão ativa

## 7. Segurança

### 7.1 Autenticação e Autorização
- JWT via Supabase Auth (RS256, rotação automática)
- Roles: admin > manager > operator > auditor
- RLS em todas as tabelas sensíveis
- Session timeout: 24h (refresh token rotation)

### 7.2 Proteção de Dados
- HTTPS obrigatório (PWA requirement)
- CSP headers via Supabase Edge Functions
- Sanitização de inputs (Zod schemas)
- Rate limiting: 100 req/min por usuário

### 7.3 Conformidade
- LGPD: Data processing agreement, right to deletion
- ANVISA: Rastreabilidade de lote/validade obrigatória
- Auditoria: Log imutável de todas as operações de balanço

---

*Documento versão 1.0 - Atualizado em 2026*