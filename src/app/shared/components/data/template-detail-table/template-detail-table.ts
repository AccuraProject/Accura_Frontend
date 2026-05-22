import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';

import { TemplateColumnDetail } from '../../../../features/templates/template-client-management/template-client-management.component';
import { Popover, PopoverModule } from 'primeng/popover';
import { CarouselModule } from 'primeng/carousel';

@Component({
  selector: 'app-template-detail-table',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    PopoverModule,
    CarouselModule,
  ],
  templateUrl: './template-detail-table.html',
  styleUrl: './template-detail-table.scss',
})
export class TemplateDetailTableComponent {
  @Input() data: TemplateColumnDetail[] = [];
  @Input() loading = false;
  @Input() isImporting = false;

  @Output() downloadTemplate = new EventEmitter<void>();
  @Output() importExcel = new EventEmitter<File>();

  @ViewChild('op') op!: Popover;

  currentRules: any[] = [];
  isPopoverVisible = false;

  onRulesButtonClick(rules: any[], rowIndex: number): void {
    if (this.isPopoverVisible) {
      this.op.hide();
      this.isPopoverVisible = false;
    } else {
      // Si no está visible, lo mostramos
      this.currentRules = rules.map((rule) => {
        const flattenedSummary = rule.summary?.rules?.[0] || {};
        return {
          ...rule,
          summary: flattenedSummary,
        };
      });

      console.log(this.currentRules);
      this.op.show(event);
      this.isPopoverVisible = true;
    }
  }

  downloadAttachment(attachment: string): void {
    const link = document.createElement('a');
    link.href = attachment;
    link.download = attachment.split('/').pop()!;
    link.click();
  }
}
