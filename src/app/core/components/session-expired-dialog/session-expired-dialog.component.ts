import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { interval } from 'rxjs';
import { map, startWith, takeWhile } from 'rxjs/operators';

const REDIRECT_COUNTDOWN_SECONDS = 5;

@Component({
  selector: 'app-session-expired-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatProgressSpinnerModule],
  templateUrl: './session-expired-dialog.component.html',
  styleUrl: './session-expired-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionExpiredDialogComponent {
  private readonly destroyRef = inject(DestroyRef);

  protected readonly countdown = signal(REDIRECT_COUNTDOWN_SECONDS);

  constructor() {
    interval(1000)
      .pipe(
        startWith(0),
        map((tick) => REDIRECT_COUNTDOWN_SECONDS - tick),
        takeWhile((value) => value >= 0),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((value) => this.countdown.set(value));
  }
}
