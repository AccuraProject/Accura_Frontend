import { Component } from '@angular/core';
import { ButtonComponent } from '../../shared/components/ui/button/button';
import { AccordionModule } from 'primeng/accordion';
import { TableModule } from 'primeng/table';
import { MANUAL_DATA_TYPES, PROMPT_ELEMENTS } from './data/user-manual.data';

@Component({
  selector: 'app-user-manual',
  imports: [AccordionModule, ButtonComponent, TableModule],
  templateUrl: './user-manual.component.html',
  styleUrl: './user-manual.component.scss',
})
export class UserManualComponent {
  protected readonly promptElements = PROMPT_ELEMENTS;
  protected readonly dataTypes = MANUAL_DATA_TYPES;

  protected activeSection = 'prompt';
  protected activeAccordionValue = '0';

  private readonly sectionAccordionMap: Record<string, string> = {
    prompt: '0',
    estructura: '1',
    'tipos-dato': '2',
    texto: '3',
    numero: '4',
    fecha: '5',
    correo: '6',
    telefono: '7',
    documento: '8',
    lista: '9',
    'lista-compleja': '10',
    dependencia: '11',
  };

  private readonly accordionSectionMap: Record<string, string> = {
    '0': 'prompt',
    '1': 'estructura',
    '2': 'tipos-dato',
    '3': 'texto',
    '4': 'numero',
    '5': 'fecha',
    '6': 'correo',
    '7': 'telefono',
    '8': 'documento',
    '9': 'lista',
    '10': 'lista-compleja',
    '11': 'dependencia',
  };

  scrollToSection(sectionId: string): void {
    const accordionValue = this.sectionAccordionMap[sectionId];

    if (accordionValue === undefined) return;

    this.activeSection = sectionId;
    this.activeAccordionValue = accordionValue;

    setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 150);
  }

  onAccordionValueChange(value: string | number | string[] | number[] | null | undefined): void {
    if (value === null || value === undefined) return;

    const normalizedValue = Array.isArray(value) ? value[0] : value;

    if (normalizedValue === undefined) return;

    const sectionId = this.accordionSectionMap[String(normalizedValue)];

    if (!sectionId) return;

    this.activeSection = sectionId;
  }
}
