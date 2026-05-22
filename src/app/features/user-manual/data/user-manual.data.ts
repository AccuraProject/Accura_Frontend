export interface PromptElement {
  elemento: string;
  descripcion: string;
}

export interface ManualDataType {
  tipo: string;
  descripcion: string;
  ejemplo: string;
}

export const PROMPT_ELEMENTS: PromptElement[] = [
  {
    elemento: 'Campo a validar',
    descripcion: 'Nombre exacto de la columna o campo.',
  },
  {
    elemento: 'Tipo de dato',
    descripcion:
      'Texto, número, fecha, correo, teléfono, documento, lista, lista compleja o dependencia.',
  },
  {
    elemento: 'Condición',
    descripcion: 'Regla que debe cumplir el dato.',
  },
  {
    elemento: 'Mensaje de error',
    descripcion: 'Texto que se mostrará si el dato no cumple la regla.',
  },
  {
    elemento: 'Ejemplo válido',
    descripcion: 'Valor que sí cumple la regla.',
  },
  {
    elemento: 'Ejemplo inválido',
    descripcion: 'Valor que no cumple la regla.',
  },
];

export const MANUAL_DATA_TYPES: ManualDataType[] = [
  {
    tipo: 'Texto',
    descripcion: 'Valida valores escritos como nombres, códigos o descripciones.',
    ejemplo: 'Juan Pérez',
  },
  {
    tipo: 'Número',
    descripcion: 'Valida cantidades, montos, porcentajes o valores numéricos.',
    ejemplo: '1500',
  },
  {
    tipo: 'Fecha',
    descripcion: 'Valida fechas con un formato específico.',
    ejemplo: '15/08/2025',
  },
  {
    tipo: 'Correo',
    descripcion: 'Valida direcciones de correo electrónico.',
    ejemplo: 'usuario@empresa.com',
  },
  {
    tipo: 'Teléfono',
    descripcion: 'Valida números telefónicos.',
    ejemplo: '987654321',
  },
  {
    tipo: 'Documento',
    descripcion: 'Valida documentos como DNI, RUC, CE o pasaporte.',
    ejemplo: '12345678',
  },
  {
    tipo: 'Lista',
    descripcion: 'Valida que un campo pertenezca a una lista simple de valores permitidos.',
    ejemplo: 'Activo, Inactivo',
  },
  {
    tipo: 'Lista compleja',
    descripcion: 'Valida que una combinación de varias columnas sea válida.',
    ejemplo: 'Departamento, Provincia, Distrito',
  },
  {
    tipo: 'Dependencia',
    descripcion: 'Valida un campo según el valor de otro campo.',
    ejemplo: 'Si Tipo Documento es DNI, Número Documento debe tener 8 dígitos.',
  },
];
