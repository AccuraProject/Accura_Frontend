export type RuleExample = Record<string, unknown>;

export interface RulePayload {
  'Nombre de la regla': string;
  'Tipo de dato': string;
  'Campo obligatorio': boolean;
  Header: string[];
  'Mensaje de error': string;
  'Descripción': string;
  'Ejemplo': RuleExample;
  'Regla': Record<string, unknown>;
}

export const VALIDATION_RULE_AI_SCHEMA: Record<string, unknown> = {
  title: 'Regla de Campo',
  type: 'object',
  additionalProperties: false,
  required: [
    'Nombre de la regla',
    'Tipo de dato',
    'Campo obligatorio',
    'Header',
    'Mensaje de error',
    'Descripción',
    'Ejemplo',
    'Regla'
  ],
  properties: {
    'Nombre de la regla': { type: 'string', minLength: 1 },
    'Tipo de dato': {
      type: 'string',
      enum: [
        'Texto',
        'Número',
        'Documento',
        'Lista',
        'Lista compleja',
        'Telefono',
        'Correo',
        'Fecha',
        'Dependencia',
        'Validación conjunta',
        'Duplicados'
      ]
    },
    'Campo obligatorio': { type: 'boolean' },
    'Mensaje de error': { type: 'string' },
    'Descripción': { type: 'string' },
    Ejemplo: {},
    Header: {
      type: 'array',
      minItems: 1,
      items: { type: 'string', minLength: 1 }
    },
    Regla: {}
  },
  allOf: [
    {
      if: { properties: { 'Tipo de dato': { const: 'Texto' } } },
      then: {
        properties: {
          Regla: {
            type: 'object',
            additionalProperties: false,
            required: ['Longitud minima', 'Longitud maxima'],
            properties: {
              'Longitud minima': { type: 'integer', minimum: 0 },
              'Longitud maxima': { type: 'integer', minimum: 0 }
            }
          }
        }
      }
    },
    {
      if: { properties: { 'Tipo de dato': { const: 'Número' } } },
      then: {
        properties: {
          Regla: {
            type: 'object',
            additionalProperties: false,
            required: ['Valor mínimo', 'Valor máximo', 'Número de decimales'],
            properties: {
              'Valor mínimo': { type: ['number', 'null'] },
              'Valor máximo': { type: ['number', 'null'] },
              'Número de decimales': { type: 'integer', minimum: 0 }
            }
          }
        }
      }
    },
    {
      if: { properties: { 'Tipo de dato': { const: 'Documento' } } },
      then: {
        properties: {
          Regla: {
            type: 'object',
            additionalProperties: false,
            required: ['Longitud minima', 'Longitud maxima'],
            properties: {
              'Longitud minima': { type: 'integer', minimum: 1 },
              'Longitud maxima': { type: 'integer', minimum: 1 }
            }
          }
        }
      }
    },
    {
      if: { properties: { 'Tipo de dato': { const: 'Lista' } } },
      then: {
        properties: {
          Regla: {
            type: 'object',
            additionalProperties: false,
            required: ['Lista'],
            properties: {
              Lista: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'string',
                  minLength: 1
                }
              }
            }
          }
        }
      }
    },
    {
      if: { properties: { 'Tipo de dato': { const: 'Lista compleja' } } },
      then: {
        properties: {
          Regla: {
            type: 'object',
            additionalProperties: false,
            required: ['Lista compleja'],
            properties: {
              'Lista compleja': {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  minProperties: 1,
                  additionalProperties: {
                    oneOf: [
                      { type: 'string', minLength: 1 },
                      { type: 'number' }
                    ]
                  }
                }
              }
            }
          }
        }
      }
    },
    {
      if: { properties: { 'Tipo de dato': { const: 'Telefono' } } },
      then: {
        properties: {
          Regla: {
            type: 'object',
            additionalProperties: false,
            required: ['Longitud minima', 'Código de país'],
            properties: {
              'Longitud minima': { type: 'integer', minimum: 1 },
              'Código de país': { type: 'string', pattern: '^\\+\\d{1,3}$' }
            }
          }
        }
      }
    },
    {
      if: { properties: { 'Tipo de dato': { const: 'Correo' } } },
      then: {
        properties: {
          Regla: {
            type: 'object',
            additionalProperties: false,
            required: ['Formato', 'Longitud máxima'],
            properties: {
              Formato: { type: 'string' },
              'Longitud máxima': { type: 'integer', minimum: 1 }
            }
          }
        }
      }
    },
    {
      if: { properties: { 'Tipo de dato': { const: 'Fecha' } } },
      then: {
        properties: {
          Regla: {
            type: 'object',
            additionalProperties: false,
            required: ['Formato', 'Fecha mínima', 'Fecha máxima'],
            properties: {
              Formato: { type: 'string', enum: ['yyyy-MM-dd', 'dd/MM/yyyy', 'MM-dd-yyyy'] },
              'Fecha mínima': { type: 'string', minLength: 1 },
              'Fecha máxima': { type: 'string', minLength: 1 }
            }
          }
        }
      }
    },
    {
      if: { properties: { 'Tipo de dato': { const: 'Dependencia' } } },
      then: {
        properties: {
          Regla: {
            type: 'object',
            additionalProperties: false,
            required: ['reglas especifica'],
            properties: {
              'reglas especifica': {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  minProperties: 2,
                  properties: {
                    Texto: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['Longitud minima', 'Longitud maxima'],
                      properties: {
                        'Longitud minima': { type: 'integer', minimum: 0 },
                        'Longitud maxima': { type: 'integer', minimum: 0 }
                      }
                    },
                    'Número': {
                      type: 'object',
                      additionalProperties: false,
                      required: ['Valor mínimo', 'Valor máximo', 'Número de decimales'],
                      properties: {
                        'Valor mínimo': { type: ['number', 'null'] },
                        'Valor máximo': { type: ['number', 'null'] },
                        'Número de decimales': { type: 'integer', minimum: 0 }
                      }
                    },
                    Documento: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['Longitud minima', 'Longitud maxima'],
                      properties: {
                        'Longitud minima': { type: 'integer', minimum: 1 },
                        'Longitud maxima': { type: 'integer', minimum: 1 }
                      }
                    },
                    Lista: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['Lista'],
                      properties: {
                        Lista: {
                          type: 'array',
                          minItems: 1,
                          items: { type: 'string', minLength: 1 }
                        }
                      }
                    },
                    'Lista compleja': {
                      type: 'object',
                      additionalProperties: false,
                      required: ['Lista compleja'],
                      properties: {
                        'Lista compleja': {
                          type: 'array',
                          minItems: 1,
                          items: {
                            type: 'object',
                            minProperties: 1,
                            additionalProperties: {
                              anyOf: [
                                { type: 'string', minLength: 1 },
                                { type: 'number' }
                              ]
                            }
                          }
                        }
                      }
                    },
                    Telefono: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['Longitud minima', 'Código de país'],
                      properties: {
                        'Longitud minima': { type: 'integer', minimum: 1 },
                        'Código de país': { type: 'string', pattern: '^\\+\\d{1,3}$' }
                      }
                    },
                    Correo: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['Formato', 'Longitud máxima'],
                      properties: {
                        Formato: { type: 'string', minLength: 1 },
                        'Longitud máxima': { type: 'integer', minimum: 1 }
                      }
                    },
                    Fecha: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['Formato', 'Fecha mínima', 'Fecha máxima'],
                      properties: {
                        Formato: { type: 'string', enum: ['yyyy-MM-dd', 'dd/MM/yyyy', 'MM-dd-yyyy'] },
                        'Fecha mínima': { type: 'string', minLength: 1 },
                        'Fecha máxima': { type: 'string', minLength: 1 }
                      }
                    }
                  },
                  patternProperties: {
                    '^(?!(Texto|Número|Documento|Lista|Lista compleja|Telefono|Correo|Fecha)$).+': {
                      anyOf: [
                        { type: 'string', minLength: 1 },
                        { type: 'number' },
                        { type: 'boolean' }
                      ]
                    }
                  },
                  additionalProperties: false,
                  anyOf: [
                    { required: ['Texto'] },
                    { required: ['Número'] },
                    { required: ['Documento'] },
                    { required: ['Lista'] },
                    { required: ['Lista compleja'] },
                    { required: ['Telefono'] },
                    { required: ['Correo'] },
                    { required: ['Fecha'] }
                  ]
                }
              }
            }
          }
        }
      }
    }
  ]
};

export function generateDefaultRuleConfig(dataType: string): Record<string, unknown> {
  switch (dataType) {
    case 'Texto':
      return { 'Longitud minima': 0, 'Longitud maxima': 0 };
    case 'Número':
      return { 'Valor mínimo': null, 'Valor máximo': null, 'Número de decimales': 0 };
    case 'Documento':
      return { 'Longitud minima': 1, 'Longitud maxima': 1 };
    case 'Lista':
      return { Lista: [] };
    case 'Lista compleja':
      return { 'Lista compleja': { headers: [], values: [], rows: [] } };
    case 'Telefono':
      return { 'Longitud minima': 1, 'Código de país': '+00' };
    case 'Correo':
      return { Formato: 'usuario@dominio.com', 'Longitud máxima': 1 };
    case 'Fecha':
      return { Formato: 'yyyy-MM-dd', 'Fecha mínima': '1900-01-01', 'Fecha máxima': '2100-12-31' };
    case 'Dependencia':
      return { 'reglas especifica': { headers: [], values: [], rows: [] } };
    case 'Validación conjunta':
      return { 'Nombre de campos': [] };
    case 'Duplicados':
      return { Campos: [], 'Ignorar vacios': false };
    default:
      return {};
  }
}

export function extractAiPayloads(response: unknown): unknown[] {
  if (!response || typeof response !== 'object') {
    return [];
  }

  const container = response as Record<string, unknown>;

  if (Array.isArray(container['result'])) {
    return container['result'] as unknown[];
  }

  const possibleKeys = ['results', 'data', 'rules', 'Reglas', 'items', 'suggestions'];
  for (const key of possibleKeys) {
    const value = container[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  const singleRule = container['rule'];
  if (singleRule && typeof singleRule === 'object') {
    return [singleRule];
  }

  return [container];
}

export function normalizeAiPayload(payload: unknown): RulePayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const name = sanitizeString(record['Nombre de la regla']) ?? 'Regla generada por IA';
  const dataType = sanitizeString(record['Tipo de dato']) ?? 'Texto';
  const mandatory = toBoolean(record['Campo obligatorio']);
  const header = sanitizeHeader('Header' in record ? record['Header'] : record['header']);
  const errorMessage =
    sanitizeString(record['Mensaje de error']) ?? 'La validación no proporcionó un mensaje de error específico.';
  const description = sanitizeString(record['Descripción']) ?? 'Descripción generada automáticamente.';
  const example = sanitizeExample(record['Ejemplo']);
  const ruleConfig = sanitizeRuleConfig(record['Regla'], dataType);

  return {
    'Nombre de la regla': name,
    'Tipo de dato': dataType,
    'Campo obligatorio': mandatory,
    Header: header.length > 0 ? header : ['Plantilla Global'],
    'Mensaje de error': errorMessage,
    'Descripción': description,
    'Ejemplo': example,
    'Regla': ruleConfig
  };
}

export function describeRuleConfig(payload: RulePayload): string[] {
  const config = payload['Regla'];
  if (!config || typeof config !== 'object') {
    return [];
  }

  const record = config as Record<string, unknown>;
  const entries: string[] = [];

  switch (payload['Tipo de dato']) {
    case 'Texto':
      entries.push(`Longitud mínima: ${record['Longitud minima'] ?? '—'}`);
      entries.push(`Longitud máxima: ${record['Longitud maxima'] ?? '—'}`);
      break;
    case 'Número':
      entries.push(`Valor mínimo: ${record['Valor mínimo'] ?? '—'}`);
      entries.push(`Valor máximo: ${record['Valor máximo'] ?? '—'}`);
      entries.push(`Número de decimales: ${record['Número de decimales'] ?? '—'}`);
      break;
    case 'Documento':
      entries.push(`Longitud mínima: ${record['Longitud minima'] ?? '—'}`);
      entries.push(`Longitud máxima: ${record['Longitud maxima'] ?? '—'}`);
      break;
    case 'Lista':
      entries.push(
        `Valores permitidos: ${Array.isArray(record['Lista']) ? (record['Lista'] as unknown[])
            .map((item) => stringifyValue(item))
            .join(', ') : '—'}`
      );
      break;
    case 'Lista compleja': {
      const table = record['Lista compleja'] as Record<string, unknown> | undefined;
      const headers = Array.isArray(table?.['headers'])
        ? (table?.['headers'] as unknown[]).map((item) => stringifyValue(item)).filter((text) => text.length > 0)
        : [];
      const values = Array.isArray(table?.['values'])
        ? (table?.['values'] as unknown[])
        : Array.isArray(table?.['rows'])
          ? (table?.['rows'] as unknown[])
          : [];

      entries.push(`Columnas configuradas: ${headers.length > 0 ? headers.join(', ') : '—'}`);
      entries.push(`Filas configuradas: ${values.length}`);
      break;
    }
    case 'Telefono':
      entries.push(`Longitud mínima: ${record['Longitud minima'] ?? '—'}`);
      entries.push(`Código de país: ${record['Código de país'] ?? '—'}`);
      break;
    case 'Correo':
      entries.push(`Formato: ${record['Formato'] ?? '—'}`);
      entries.push(`Longitud máxima: ${record['Longitud máxima'] ?? '—'}`);
      break;
    case 'Fecha':
      entries.push(`Formato: ${record['Formato'] ?? '—'}`);
      entries.push(`Fecha mínima: ${record['Fecha mínima'] ?? '—'}`);
      entries.push(`Fecha máxima: ${record['Fecha máxima'] ?? '—'}`);
      break;
    case 'Dependencia': {
      const table = record['reglas especifica'] as Record<string, unknown> | undefined;
      const values = Array.isArray(table?.['values'])
        ? (table?.['values'] as unknown[])
        : Array.isArray(table?.['rows'])
          ? (table?.['rows'] as unknown[])
          : [];
      entries.push(`Dependencias configuradas: ${values.length}`);
      break;
    }
    case 'Validación conjunta':
      entries.push(
        `Campos relacionados: ${Array.isArray(record['Nombre de campos']) ? (record['Nombre de campos'] as unknown[])
            .map((item) => stringifyValue(item))
            .join(', ') : '—'}`
      );
      break;
    case 'Duplicados':
      entries.push(
        `Campos a validar: ${Array.isArray(record['Campos']) ? (record['Campos'] as unknown[])
            .map((item) => stringifyValue(item))
            .join(', ') : '—'}`
      );
      entries.push(`Ignorar vacíos: ${toBoolean(record['Ignorar vacios']) ? 'Sí' : 'No'}`);
      break;
    default:
      break;
  }

  return entries;
}

export function getExampleEntries(payload: RulePayload): Array<{ key: string; value: string }> {
  const example = payload['Ejemplo'];
  if (!example || typeof example !== 'object' || Array.isArray(example)) {
    return [];
  }

  return Object.entries(example).map(([key, value]) => ({
    key,
    value: stringifyValue(value)
  }));
}

function sanitizeHeader(value: unknown): string[] {
  if (Array.isArray(value)) {
    return (value as unknown[]).filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return [value.trim()];
  }

  return [];
}

function sanitizeExample(value: unknown): RuleExample {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return { ...(value as Record<string, unknown>) };
}

function sanitizeRuleConfig(value: unknown, dataType: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return generateDefaultRuleConfig(dataType);
  }

  const record = { ...(value as Record<string, unknown>) };

  switch (dataType) {
    case 'Texto':
      record['Longitud minima'] = toNumber(record['Longitud minima'], 0);
      record['Longitud maxima'] = toNumber(record['Longitud maxima'], 0);
      break;
    case 'Número':
      record['Valor mínimo'] = toNumber(record['Valor mínimo'], null);
      record['Valor máximo'] = toNumber(record['Valor máximo'], null);
      record['Número de decimales'] = toNumber(record['Número de decimales'], 0);
      break;
    case 'Documento':
      record['Longitud minima'] = toNumber(record['Longitud minima'], 1);
      record['Longitud maxima'] = toNumber(record['Longitud maxima'], 1);
      break;
    case 'Lista': {
      const values = Array.isArray(record['Lista'])
        ? (record['Lista'] as unknown[]).filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
      record['Lista'] = values;
      break;
    }
    case 'Lista compleja':
      record['Lista compleja'] = sanitizeAdvancedTable(record['Lista compleja']);
      break;
    case 'Telefono':
      record['Longitud minima'] = toNumber(record['Longitud minima'], 1);
      record['Código de país'] = sanitizeString(record['Código de país']) ?? '+00';
      break;
    case 'Correo':
      record['Formato'] = sanitizeString(record['Formato']) ?? 'usuario@dominio.com';
      record['Longitud máxima'] = toNumber(record['Longitud máxima'], 1);
      break;
    case 'Fecha':
      record['Formato'] = sanitizeString(record['Formato']) ?? 'yyyy-MM-dd';
      record['Fecha mínima'] = sanitizeString(record['Fecha mínima']) ?? '1900-01-01';
      record['Fecha máxima'] = sanitizeString(record['Fecha máxima']) ?? '2100-12-31';
      break;
    case 'Dependencia':
      record['reglas especifica'] = sanitizeAdvancedTable(record['reglas especifica']);
      break;
    case 'Validación conjunta':
      record['Nombre de campos'] = Array.isArray(record['Nombre de campos'])
        ? (record['Nombre de campos'] as unknown[]).filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
      break;
    case 'Duplicados':
      record['Campos'] = Array.isArray(record['Campos'])
        ? (record['Campos'] as unknown[]).filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
      if ('Ignorar vacios' in record) {
        record['Ignorar vacios'] = toBoolean(record['Ignorar vacios']);
      }
      break;
    default:
      break;
  }

  return record;
}

function sanitizeAdvancedTable(value: unknown): { headers: string[]; values: Array<Record<string, string>>; rows: Array<Record<string, string>> } {
  if (!value) {
    return { headers: [], values: [], rows: [] };
  }

  if (Array.isArray(value)) {
    const rows = sanitizeAdvancedRows(value);
    const headers = extractAdvancedHeaders(rows);
    return { headers, values: rows, rows };
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const headers = Array.isArray(record['headers'])
      ? (record['headers'] as unknown[])
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index)
      : [];

    const sourceRows = record['values'] ?? record['rows'] ?? record['data'];
    const rows = sanitizeAdvancedRows(sourceRows);

    if (headers.length === 0) {
      const inferred = extractAdvancedHeaders(rows);
      return { headers: inferred, values: rows, rows };
    }

    const alignedRows = rows.map((row) => alignAdvancedRow(row, headers));
    return { headers, values: alignedRows, rows: alignedRows };
  }

  return { headers: [], values: [], rows: [] };
}

function sanitizeAdvancedRows(value: unknown): Array<Record<string, string>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeAdvancedRow(item))
    .filter((row): row is Record<string, string> => row !== null)
    .map((row) => {
      const cleaned: Record<string, string> = {};
      Object.entries(row).forEach(([key, cell]) => {
        const header = typeof key === 'string' ? key.trim() : '';
        if (!header) {
          return;
        }
        const text = sanitizeString(cell) ?? stringifyValue(cell);
        cleaned[header] = text;
      });
      return cleaned;
    })
    .filter((row) => Object.keys(row).length > 0);
}

function normalizeAdvancedRow(value: unknown): Record<string, string> | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    const record: Record<string, string> = {};
    value.forEach((cell, index) => {
      const header = `Columna ${index + 1}`;
      record[header] = sanitizeString(cell) ?? stringifyValue(cell);
    });
    return record;
  }

  if (typeof value === 'object') {
    const record: Record<string, string> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, cell]) => {
      const header = typeof key === 'string' ? key.trim() : '';
      if (!header) {
        return;
      }

      record[header] = sanitizeString(cell) ?? stringifyValue(cell);
    });
    return record;
  }

  return null;
}

function extractAdvancedHeaders(rows: Array<Record<string, string>>): string[] {
  const headers = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      const header = key.trim();
      if (header.length > 0) {
        headers.add(header);
      }
    });
  });

  return Array.from(headers);
}

function alignAdvancedRow(row: Record<string, string>, headers: string[]): Record<string, string> {
  return headers.reduce<Record<string, string>>((acc, header) => {
    const value = row[header] ?? '';
    acc[header] = typeof value === 'string' ? value : sanitizeString(value) ?? stringifyValue(value);
    return acc;
  }, {});
}

function sanitizeString(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', '1', 'si', 'sí', 'yes'].includes(normalized);
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return false;
}

function toNumber(value: unknown, defaultValue: number | null): number | null {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return defaultValue;
  }

  return numeric;
}

function stringifyValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => stringifyValue(item)).join(', ');
  }

  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[Objeto]';
    }
  }

  if (value === null || value === undefined) {
    return '—';
  }

  return String(value);
}

export { stringifyValue };
