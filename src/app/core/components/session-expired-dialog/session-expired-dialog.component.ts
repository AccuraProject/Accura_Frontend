import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';
import { DialogModule } from 'primeng/dialog';
import { interval } from 'rxjs';
import { map, startWith, takeWhile } from 'rxjs/operators';
import { MessageModule } from 'primeng/message';

const REDIRECT_COUNTDOWN_SECONDS = 5;

@Component({
  selector: 'app-session-expired-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule, DynamicDialogModule, MessageModule], 
  providers: [DialogService],
  templateUrl: './session-expired-dialog.component.html',
  styleUrls: ['./session-expired-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionExpiredDialogComponent {
  private readonly destroyRef = inject(DestroyRef);

  protected readonly count = REDIRECT_COUNTDOWN_SECONDS;
  protected readonly countdown = signal(REDIRECT_COUNTDOWN_SECONDS);
  public visible = false;

  constructor(public dialogService: DialogService) {
    interval(1000)
      .pipe(
        startWith(0),
        map((tick) => REDIRECT_COUNTDOWN_SECONDS - tick),
        takeWhile((value) => value >= 0),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((value) => this.countdown.set(value));

    this.visible = true;
  }
}
