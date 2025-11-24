export type RuleExample = Record<string, unknown>;

export const DEFAULT_RULE_ERROR_MESSAGE =
  'La validación no proporcionó un mensaje de error específico.';

export interface RulePayload {
  'Nombre de la regla': string;
  'Tipo de dato': string;
  'Campo obligatorio': boolean;
  Header: string[];
  'Header rule': string[];
  'Mensaje de error': string;
  'Descripción': string;
  'Ejemplo': RuleExample;
  'Regla': Record<string, unknown>;
}

export interface RuleTableData {
  columns: string[];
  rows: Array<Record<string, string>>;
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
    'Header rule',
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
        'Teléfono',
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
    'Header rule': {
      type: 'array',
      minItems: 0,
      items: { type: 'string' }
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
            required: ['Longitud mínima', 'Longitud máxima'],
            properties: {
              'Longitud mínima': { type: 'integer', minimum: 0 },
              'Longitud máxima': { type: 'integer', minimum: 0 }
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
            required: ['Longitud mínima', 'Longitud máxima'],
            properties: {
              'Longitud mínima': { type: 'integer', minimum: 1 },
              'Longitud máxima': { type: 'integer', minimum: 1 }
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
      if: { properties: { 'Tipo de dato': { const: 'Teléfono' } } },
      then: {
        properties: {
          Regla: {
            type: 'object',
            additionalProperties: false,
            required: ['Longitud mínima', 'Código de país'],
            properties: {
              'Longitud mínima': { type: 'integer', minimum: 1 },
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
                      required: ['Longitud mínima', 'Longitud máxima'],
                      properties: {
                        'Longitud mínima': { type: 'integer', minimum: 0 },
                        'Longitud máxima': { type: 'integer', minimum: 0 }
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
                      required: ['Longitud mínima', 'Longitud máxima'],
                      properties: {
                        'Longitud mínima': { type: 'integer', minimum: 1 },
                        'Longitud máxima': { type: 'integer', minimum: 1 }
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
                    Teléfono: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['Longitud mínima', 'Código de país'],
                      properties: {
                        'Longitud mínima': { type: 'integer', minimum: 1 },
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
                    '^(?!(Texto|Número|Documento|Lista|Lista compleja|Teléfono|Correo|Fecha)$).+': {
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
                    { required: ['Teléfono'] },
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
      return { 'Longitud mínima': 0, 'Longitud máxima': 0 };
    case 'Número':
      return { 'Valor mínimo': null, 'Valor máximo': null, 'Número de decimales': 0 };
    case 'Documento':
      return { 'Longitud mínima': 1, 'Longitud máxima': 1 };
    case 'Lista':
      return { Lista: [] };
    case 'Lista compleja':
      return { 'Lista compleja': [] };
    case 'Teléfono':
      return { 'Longitud mínima': 1, 'Código de país': '+00' };
    case 'Correo':
      return { Formato: 'usuario@dominio.com', 'Longitud máxima': 1 };
    case 'Fecha':
      return { Formato: 'yyyy-MM-dd', 'Fecha mínima': '1900-01-01', 'Fecha máxima': '2100-12-31' };
    case 'Dependencia':
      return { 'reglas especifica': [] };
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
  let header = sanitizeHeader('Header' in record ? record['Header'] : record['header']);
  const headerRule = sanitizeHeaderRule(record['Header rule']);
  const errorMessage = sanitizeString(record['Mensaje de error']) ?? DEFAULT_RULE_ERROR_MESSAGE;
  const description = sanitizeString(record['Descripción']) ?? 'Descripción generada automáticamente.';
  const example = sanitizeExample(record['Ejemplo']);
  const ruleConfig = sanitizeRuleConfig(record['Regla'], dataType);
  header = correctHeaderWithRules(header, headerRule, ruleConfig, dataType);

  return {
    'Nombre de la regla': name,
    'Tipo de dato': dataType,
    'Campo obligatorio': mandatory,
    Header: header.length > 0 ? header : ['Plantilla Global'],
    'Header rule': headerRule,
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

  if (payload['Tipo de dato'] === 'Lista compleja') {
    return entries;
  }

  switch (payload['Tipo de dato']) {
    case 'Texto':
      entries.push(`Longitud mínima: ${record['Longitud mínima'] ?? '—'}`);
      entries.push(`Longitud máxima: ${record['Longitud máxima'] ?? '—'}`);
      break;
    case 'Número':
      entries.push(`Valor mínimo: ${record['Valor mínimo'] ?? '—'}`);
      entries.push(`Valor máximo: ${record['Valor máximo'] ?? '—'}`);
      entries.push(`Número de decimales: ${record['Número de decimales'] ?? '—'}`);
      break;
    case 'Documento':
      entries.push(`Longitud mínima: ${record['Longitud mínima'] ?? '—'}`);
      entries.push(`Longitud máxima: ${record['Longitud máxima'] ?? '—'}`);
      break;
    case 'Lista':
      entries.push(
        `Valores permitidos: ${Array.isArray(record['Lista']) ? (record['Lista'] as unknown[])
            .map((item) => stringifyValue(item))
            .join(', ') : '—'}`
      );
      break;
    case 'Teléfono':
      entries.push(`Longitud mínima: ${record['Longitud mínima'] ?? '—'}`);
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
    case 'Dependencia':
      entries.push(`Dependencias configuradas: ${Array.isArray(record['reglas especifica']) ? (record['reglas especifica'] as unknown[]).length : 0}`);
      break;
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

export function extractRuleTable(payload: RulePayload): RuleTableData | null {
  const headers = Array.isArray(payload.Header)
    ? (payload.Header as unknown[])
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index)
    : [];

  const config = payload['Regla'];
  if (!config || typeof config !== 'object') {
    return headers.length > 0 ? { columns: headers, rows: [] } : null;
  }

  const record = config as Record<string, unknown>;
  let source: unknown[] = [];

  if (payload['Tipo de dato'] === 'Lista compleja') {
    source = Array.isArray(record['Lista compleja'])
      ? (record['Lista compleja'] as unknown[])
      : [];
  } else if (payload['Tipo de dato'] === 'Dependencia') {
    source = Array.isArray(record['reglas especifica'])
      ? (record['reglas especifica'] as unknown[])
      : [];
  } else {
    return headers.length > 0 ? { columns: headers, rows: [] } : null;
  }

  const rows = source
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => sanitizeComplexListRow(item))
    .filter((row) => Object.keys(row).length > 0);

  if (rows.length === 0) {
    return headers.length > 0 ? { columns: headers, rows: [] } : null;
  }

  const columns: string[] = [];
  const hasColumn = (list: string[], label: string): boolean =>
    list.some((column) => column.trim().toLowerCase() === label.trim().toLowerCase());

  headers.forEach((header) => {
    if (header && !hasColumn(columns, header)) {
      columns.push(header);
    }
  });

  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      const label = key.trim();
      if (!label || hasColumn(columns, label)) {
        return;
      }

      columns.push(label);
    });
  });

  if (columns.length === 0) {
    return null;
  }

  const normalizedRows = rows
    .map((row) => {
      const normalized = Object.entries(row).reduce<Record<string, string>>((acc, [key, value]) => {
        const label = typeof key === 'string' ? key.trim() : '';
        if (label.length === 0) {
          return acc;
        }

        acc[label.toLowerCase()] = value;
        return acc;
      }, {});

      return columns.reduce<Record<string, string>>((acc, column) => {
        const text = normalized[column.toLowerCase()] ?? '';
        acc[column] = text === '—' ? '' : text;
        return acc;
      }, {});
    })
    .filter((row) => columns.some((column) => (row[column] ?? '').trim().length > 0));

  if (normalizedRows.length === 0) {
    return { columns, rows: [] };
  }

  return { columns, rows: normalizedRows };
}

function correctHeaderWithRules(
  header: string[],
  headerRule: string[],
  ruleConfig: Record<string, unknown>,
  dataType: string
): string[] {
  if (headerRule.length === 0) {
    return header;
  }

  if (dataType !== 'Dependencia' || !ruleConfig || typeof ruleConfig !== 'object') {
    return header.length > 0 ? header : headerRule;
  }

  const normalizedRule = headerRule.filter((item) => typeof item === 'string' && item.trim().length > 0);
  if (normalizedRule.length < 2) {
    return header.length > 0 ? header : normalizedRule;
  }

  const dependencyColumn = normalizedRule[0];
  const dependentColumn = normalizedRule[1];
  const specificRules = Array.isArray(ruleConfig['reglas especifica'])
    ? (ruleConfig['reglas especifica'] as unknown[])
    : [];

  const rules = specificRules.filter(
    (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)
  );

  if (rules.length === 0) {
    return header.length > 0 ? header : normalizedRule;
  }

  const dependentValues = collectValuesForKey(rules, dependentColumn);

  if (dependentValues.some((value) => Array.isArray(value))) {
    return normalizedRule;
  }

  const nestedObjects = dependentValues.filter(
    (value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  );

  if (nestedObjects.length === 0) {
    return header.length > 0 ? header : normalizedRule;
  }

  const nestedKeys: string[] = [];
  const hasKey = (label: string): boolean =>
    nestedKeys.some((item) => item.trim().toLowerCase() === label.trim().toLowerCase());

  nestedObjects.forEach((entry) => {
    Object.keys(entry).forEach((key) => {
      const label = key.trim();
      if (label && !hasKey(label)) {
        nestedKeys.push(label);
      }
    });
  });

  return nestedKeys.length > 0 ? [dependencyColumn, ...nestedKeys] : normalizedRule;
}

function collectValuesForKey(records: Array<Record<string, unknown>>, target: string): unknown[] {
  const targetKey = target.trim().toLowerCase();
  const values: unknown[] = [];

  const visit = (record: Record<string, unknown>): void => {
    Object.entries(record).forEach(([key, value]) => {
      const label = typeof key === 'string' ? key.trim() : '';
      if (!label) {
        return;
      }

      if (label.toLowerCase() === targetKey) {
        values.push(value);
      }

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        visit(value as Record<string, unknown>);
      }
    });
  };

  records.forEach((record) => visit(record));

  return values;
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

function sanitizeHeaderRule(value: unknown): string[] {
  if (Array.isArray(value)) {
    return (value as unknown[])
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : [];
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
      record['Longitud mínima'] = toNumber(record['Longitud mínima'], 0);
      record['Longitud máxima'] = toNumber(record['Longitud máxima'], 0);
      break;
    case 'Número':
      record['Valor mínimo'] = toNumber(record['Valor mínimo'], null);
      record['Valor máximo'] = toNumber(record['Valor máximo'], null);
      record['Número de decimales'] = toNumber(record['Número de decimales'], 0);
      break;
    case 'Documento':
      record['Longitud mínima'] = toNumber(record['Longitud mínima'], 1);
      record['Longitud máxima'] = toNumber(record['Longitud máxima'], 1);
      break;
    case 'Lista': {
      const values = Array.isArray(record['Lista'])
        ? (record['Lista'] as unknown[]).filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
      record['Lista'] = values;
      break;
    }
    case 'Lista compleja':
      record['Lista compleja'] = Array.isArray(record['Lista compleja'])
        ? (record['Lista compleja'] as unknown[])
            .map((item) => sanitizeComplexListRow(item))
            .filter((row) => Object.keys(row).length > 0)
        : [];
      break;
    case 'Teléfono':
      record['Longitud mínima'] = toNumber(record['Longitud mínima'], 1);
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
      record['reglas especifica'] = Array.isArray(record['reglas especifica'])
        ? (record['reglas especifica'] as unknown[]).filter((item) => item && typeof item === 'object')
        : [];
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

function sanitizeComplexListRow(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (acc, [key, cell]) => {
      const label = typeof key === 'string' ? key.trim() : '';
      if (!label) {
        return acc;
      }

      const text = stringifyValue(cell).trim();
      if (text.length === 0 || text === '—') {
        return acc;
      }

      acc[label] = text;
      return acc;
    },
    {}
  );

  return entries;
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
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const label = typeof key === 'string' ? key.trim() : '';
        const text = stringifyValue(item);

        if (label.length > 0 && text.length > 0) {
          return `${label}: ${text}`;
        }

        if (label.length > 0) {
          return label;
        }

        return text;
      })
      .filter((entry) => entry.length > 0);

    return entries.length > 0 ? entries.join(', ') : '—';
  }

  if (value === null || value === undefined) {
    return '—';
  }

  return String(value);
}

export { stringifyValue };
