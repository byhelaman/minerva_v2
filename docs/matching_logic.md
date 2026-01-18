# Sistema de Matching - Documentación Técnica

## Visión General

El sistema de matching conecta **schedules** (horarios de clases) con **meetings de Zoom** e **instructores**. El objetivo es encontrar automáticamente qué reunión de Zoom corresponde a cada clase programada.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        MatchingService                          │
│                     (matcher.ts)                                │
├─────────────────────────────────────────────────────────────────┤
│  1. Obtener Candidatos                                          │
│     ├── Exact Match (diccionario normalizado)                   │
│     ├── Fuse.js (búsqueda fuzzy)                               │
│     └── Token Set Match (overlap de tokens)                     │
├─────────────────────────────────────────────────────────────────┤
│  2. Scoring (scorer.ts + penalties.ts)                          │
│     └── Aplicar penalizaciones a cada candidato                 │
├─────────────────────────────────────────────────────────────────┤
│  3. Decisión                                                    │
│     ├── assigned    (score ≥ 70, único candidato claro)         │
│     ├── ambiguous   (múltiples candidatos con scores similares) │
│     └── not_found   (score < 30 o sin candidatos)               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flujo de Matching

### Paso 1: Normalización

Antes de comparar, los strings pasan por `normalizeString()`:

```typescript
// Input:  "BVP - JUAN GARCIA (ONLINE) L5"
// Output: "juan garcia l5"  ← BVP y ONLINE eliminados
```

**Orden de operaciones**:
1. Convertir `_` y `-` a espacios (`F2F_PER` → `F2F PER`)
2. Eliminar palabras irrelevantes (definidas en `irrelevant-words.json`)
3. Normalizar Unicode y eliminar acentos
4. Convertir a minúsculas

### Paso 2: Búsqueda de Candidatos

El sistema intenta 3 estrategias en orden:

| Estrategia | Cuándo se usa | Ejemplo |
|------------|---------------|---------|
| **Exact Match** | Si query normalizada existe en diccionario | `"juan garcia"` → encuentra meeting exacto |
| **Fuse.js** | Si exact falla, busca por similaridad | `"juan garsia"` → encuentra `"juan garcia"` |
| **Token Set Match** | Si Fuse falla, busca por tokens compartidos | Tokens `[juan, garcia]` en común |

### Paso 3: Scoring

Cada candidato inicia con **100 puntos** y recibe penalizaciones:

```
Base Score: 100
    │
    ├── CRITICAL_TOKEN_MISMATCH  (-100) → Conflicto CH vs TRIO vs DUO
    ├── LEVEL_CONFLICT           (-100) → L3 buscado pero topic tiene L5
    ├── WEAK_MATCH               (-80)  → Ningún token distintivo coincide
    ├── PROGRAM_VS_PERSON        (-80)  → Query es programa, topic es persona
    ├── GROUP_NUMBER_CONFLICT    (-80)  → CH 1 vs CH 3
    ├── MISSING_TOKEN            (-60)  → Falta token importante (no numérico)
    ├── MISSING_NUMERIC_TOKEN    (-20)  → Falta número suelto (tolerante)
    ├── ORPHAN_LEVEL_WITH_SIBLINGS (-60) → Topic tiene nivel no solicitado
    ├── ORPHAN_NUMBER_WITH_SIBLINGS(-60) → Topic tiene número no solicitado
    ├── STRUCTURAL_TOKEN_MISSING (-50)  → Falta TRIO/CH/DUO
    └── MISSING_TOKEN_EXTRA_INFO (-10)  → Token extra cuando topic cubierto
```

### Paso 4: Decisión Final

| Score | Decisión | Significado |
|-------|----------|-------------|
| ≥ 70 | `assigned` | Match confiable |
| 50-69 | `assigned` (con warning) | Match aceptable, revisar |
| 30-49 | `ambiguous` | Múltiples candidatos posibles |
| < 30 | `not_found` | Sin match confiable |

---

## Ejemplos Prácticos

### Ejemplo 1: Match Exitoso

```
Query:   "Garcia Lopez (ACME)(ONLINE), Juan Carlos"
Topic:   "JUAN GARCIA LOPEZ - L5 (ONLINE)"

Normalización:
  Query → "garcia lopez juan carlos"
  Topic → "juan garcia lopez l5"

Tokens distintivos:
  Query: [garcia, lopez, juan, carlos]
  Topic: [juan, garcia, lopez]

Cobertura: Topic completamente cubierto ✅
Missing: [carlos] → -10 (heurística persona activa)
Score: 100 - 10 = 90 → ASSIGNED
```

### Ejemplo 2: Conflicto Crítico

```
Query:   "TRIO AGROVISION L4"
Topic:   "DUO AGROVISION L4 (ONLINE)"

Detección: Query tiene "TRIO", Topic tiene "DUO"
Resultado: CRITICAL_TOKEN_MISMATCH (-100)
Score: 100 - 100 = 0 → NOT_FOUND (TRIO vs DUO)
```

### Ejemplo 3: Ambigüedad

```
Query:   "CH AMCOR (ONLINE)"

Topics en DB:
  - "CH 1 AMCOR L2 (ONLINE)"
  - "CH 2 AMCOR L5 (ONLINE)"
  - "CH 3 AMCOR L3 (ONLINE)"

Resultado: 3 candidatos con scores similares
Decisión: AMBIGUOUS (no especificó número de grupo)
```

---

## Configuración

### irrelevant-words.json

Define palabras a eliminar durante normalización:

```json
{
  "categories": {
    "modalities": ["online", "presencial", "virtual"],
    "languages": ["english", "espanol", "ingles"],
    "program_tags": ["premium", "f2f", "travel", "summer"],
    "locations": ["per", "ven", "arg"],
    "connectors": ["de", "del", "la", "los"]
  },
  "patterns": {
    "items": ["keynotes?", "looks?", "tz\\d+"]
  }
}
```

### matching.config.ts

Configura umbrales y tipos de programa:

```typescript
export const PENALTIES = {
  CRITICAL_TOKEN_MISMATCH: -100,
  LEVEL_CONFLICT: -100,
  WEAK_MATCH: -80,
  GROUP_NUMBER_CONFLICT: -80,
  MISSING_TOKEN: -60,
  MISSING_NUMERIC_TOKEN: -20,    // Números sueltos faltantes (tolerante)
  ORPHAN_LEVEL_WITH_SIBLINGS: -60,  // Nivel extra en topic
  ORPHAN_NUMBER_WITH_SIBLINGS: -60, // Número extra en topic
  MISSING_TOKEN_EXTRA_INFO: -10,
  // ...
};

export const THRESHOLDS = {
  HIGH_CONFIDENCE: 70,
  MEDIUM_CONFIDENCE: 50,
  MINIMUM: 30,
  AMBIGUITY_DIFF: 15,
};

export const STRUCTURAL_TOKENS = new Set([
  'duo', 'trio', 'ch', 'bvd', 'bvp', 'bvs', 'privado'
]);
```

---

## Heurísticas Especiales

### Heurística de Personas

Cuando **query** y **topic** tienen formato de persona, los tokens extra (segundos nombres) penalizan menos:

```
Sin heurística: "david" faltante → -60 → Score 40 → AMBIGUOUS
Con heurística: "david" faltante → -10 → Score 90 → ASSIGNED
```

Los patrones de persona detectan formatos como:
- `"Garcia Lopez (ACME), Juan Carlos"` (formato schedule)
- `"JUAN GARCIA LOPEZ - KEYNOTES (ONLINE)"` (formato Zoom)

### Detección de Conflictos

Tipos mutuamente excluyentes:
- **CH** (Corporate Hours)
- **TRIO** (3 estudiantes)
- **DUO/BVD** (2 estudiantes)
- **PRIVADO/BVP** (1 estudiante)
- **BVS** (Basic Vocabulary Skills)

Si query tiene TRIO pero topic tiene DUO → `CRITICAL_TOKEN_MISMATCH` → descalificado.

---

## Archivos del Sistema

| Archivo | Propósito |
|---------|-----------|
| `matcher.ts` | Servicio principal, orquesta búsqueda |
| `scorer.ts` | Calcula scores y decide resultado |
| `penalties.ts` | Define funciones de penalización |
| `normalizer.ts` | Normaliza strings antes de comparar |
| `matching.config.ts` | Configuración de umbrales y tokens |
| `irrelevant-words.json` | Lista de palabras a eliminar |
| `logger.ts` | Logger con niveles (debug en dev, warn en prod) |

---

## Debugging

El logger muestra información detallada en desarrollo:

```
🔍 Match: Garcia Lopez (ACME)(ONLINE), Juan
  Raw: { program: '...', instructor: '...' }
  Normalized: { program: 'garcia lopez juan', instructor: '...' }
  📍 1 candidatos por Exact Match
  📊 Score: 90/100
     Candidato: JUAN GARCIA LOPEZ - L5 (ONLINE)
     - PARTIAL_MATCH_MISSING_TOKENS: -10 (Faltan tokens: ...)
  🏁 Resultado: ASSIGNED
```

En producción, solo se muestran warnings y errores.
