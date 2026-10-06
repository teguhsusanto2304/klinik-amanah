import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin, map, of, startWith } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { BillService } from '../../core/services/bill.service';
import { Bill, BillUpsertRequest, ServiceTariff } from '../../core/models/bill.model';
import { Visit } from '../../core/models/visit.model';
import { describeHttpError, validationErrors } from '../../core/utils/http-error';
import { BILL_ITEM_TYPE_LABELS, formatRupiah } from './bill-format';

type ServiceLine = FormGroup<{
  service_tariff_id: FormControl<number | null>;
  quantity: FormControl<number>;
}>;

interface TariffGroup {
  label: string;
  tariffs: ServiceTariff[];
}

/**
 * Form tagihan kunjungan: layanan yang ditagihkan, diskon, dan catatan.
 * Rute /main/bills/visit/:visitId = tagihan baru; /main/bills/:id/edit = ubah tagihan yang masih draft.
 * Tindakan medis/keperawatan, lab, dan farmasi ditambahkan otomatis oleh server.
 */
@Component({
  selector: 'app-bill-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/main/bills"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ billId ? 'Ubah Tagihan' : 'Buat Tagihan' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding edit-content">
      <div class="edit-wrapper">
        @if (isLoading()) {
          <section class="card state">
            <mat-spinner diameter="32"></mat-spinner>
            <p>Memuat data tagihan...</p>
          </section>
        } @else if (loadError(); as msg) {
          <section class="card state error">
            <mat-icon>error_outline</mat-icon>
            <p>{{ msg }}</p>
            <button mat-stroked-button type="button" (click)="load()">Coba lagi</button>
          </section>
        } @else {
          <!-- Kunjungan -->
          <section class="card visit">
            @if (visit(); as v) {
              <span class="queue">{{ v.formatted_queue_number }}</span>
              <div>
                <h2>{{ v.medical_record.patient?.name ?? '-' }}</h2>
                <p>{{ v.medical_record.number }} · {{ v.doctor.name }}</p>
                <p>{{ v.guarantor?.name ?? v.payment_type_label }}</p>
              </div>
            } @else {
              <div><h2>Kunjungan #{{ visitId() }}</h2></div>
            }
            @if (bill(); as b) {
              <span class="bill-number">{{ b.number }}</span>
            }
          </section>

          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <!-- Layanan -->
            <section class="card">
              <h3>Layanan</h3>
              @if (tariffGroups().length === 0) {
                <p class="muted">Belum ada tarif layanan aktif di klinik ini.</p>
              }

              <div formArrayName="services" class="lines">
                @for (line of services.controls; track line; let i = $index) {
                  <div class="line" [formGroupName]="i">
                    <mat-form-field appearance="outline" class="tariff" subscriptSizing="dynamic">
                      <mat-label>Layanan</mat-label>
                      <mat-select formControlName="service_tariff_id">
                        @for (group of tariffGroups(); track group.label) {
                          <mat-optgroup [label]="group.label">
                            @for (t of group.tariffs; track t.id) {
                              <mat-option [value]="t.id">{{ t.name }} · {{ rupiah(t.price) }}</mat-option>
                            }
                          </mat-optgroup>
                        }
                      </mat-select>
                    </mat-form-field>

                    <div class="line-foot">
                      <div class="qty">
                        <button type="button" (click)="changeQty(i, -1)" [disabled]="line.controls.quantity.value <= 1">
                          <mat-icon>remove</mat-icon>
                        </button>
                        <input type="number" formControlName="quantity" min="1" max="1000" inputmode="numeric" />
                        <button type="button" (click)="changeQty(i, 1)">
                          <mat-icon>add</mat-icon>
                        </button>
                      </div>
                      <strong>{{ rupiah(lineSubtotal(i)) }}</strong>
                      <button type="button" class="remove" (click)="removeLine(i)" aria-label="Hapus layanan">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </div>
                    @if (lineError(i); as err) {
                      <p class="field-error">{{ err }}</p>
                    }
                  </div>
                }
              </div>

              <button mat-stroked-button type="button" class="full-width" (click)="addLine()" [disabled]="tariffGroups().length === 0">
                <mat-icon>add</mat-icon> Tambah layanan
              </button>
            </section>

            <!-- Item otomatis -->
            @if (autoItems().length > 0) {
              <section class="card">
                <h3>Item Otomatis</h3>
                <p class="hint">Tindakan, laboratorium, dan farmasi ditambahkan otomatis dari data kunjungan.</p>
                @for (item of autoItems(); track item.id) {
                  <div class="auto-item">
                    <div>
                      <span class="type">{{ itemTypeLabels[item.type] }}</span>
                      <span>{{ item.description }}</span>
                      <span class="muted">{{ item.quantity }} × {{ rupiah(item.unit_price) }}</span>
                    </div>
                    <strong>{{ rupiah(item.subtotal) }}</strong>
                  </div>
                }
              </section>
            }

            <!-- Diskon & catatan -->
            <section class="card">
              <h3>Diskon &amp; Catatan</h3>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Diskon</mat-label>
                <span matTextPrefix>Rp&nbsp;</span>
                <input matInput type="number" formControlName="discount" min="0" inputmode="numeric" />
                <mat-error>{{ fieldError('discount') ?? 'Diskon tidak valid' }}</mat-error>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Catatan (opsional)</mat-label>
                <textarea matInput formControlName="notes" rows="2" maxlength="1000"></textarea>
                <mat-error>{{ fieldError('notes') }}</mat-error>
              </mat-form-field>
            </section>

            <!-- Ringkasan -->
            <section class="card totals">
              <div class="row"><span>Layanan</span><span>{{ rupiah(servicesTotal()) }}</span></div>
              @if (autoTotal() > 0) {
                <div class="row"><span>Item otomatis</span><span>{{ rupiah(autoTotal()) }}</span></div>
              }
              @if (discount() > 0) {
                <div class="row discount"><span>Diskon</span><span>− {{ rupiah(discount()) }}</span></div>
              }
              <div class="row grand"><span>Perkiraan total</span><strong>{{ rupiah(estimatedTotal()) }}</strong></div>
            </section>

            @if (submitError(); as msg) {
              <p class="submit-error"><mat-icon>error_outline</mat-icon> {{ msg }}</p>
            }

            <button mat-flat-button color="primary" type="submit" class="full-width submit" [disabled]="isSubmitting()">
              @if (isSubmitting()) {
                <mat-spinner diameter="18"></mat-spinner>
              } @else {
                <mat-icon>save</mat-icon>
              }
              Simpan Tagihan
            </button>
          </form>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .edit-content {
      --background: #f8fafc;
    }

    .edit-wrapper {
      max-width: 520px;
      margin: 0 auto;

      form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
    }

    .card {
      background: #fff;
      border-radius: 16px;
      padding: 1.25rem;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);

      h3 {
        font-size: 0.85rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #64748b;
        margin: 0 0 0.75rem 0;
      }
    }

    .full-width {
      width: 100%;
    }

    .muted {
      color: #94a3b8;
    }

    .hint {
      margin: -0.35rem 0 0.75rem;
      font-size: 0.78rem;
      color: #94a3b8;
    }

    .visit {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      margin-bottom: 1rem;

      > div {
        flex: 1;
        min-width: 0;
      }

      h2 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: #1e293b;
      }

      p {
        margin: 0.1rem 0 0;
        font-size: 0.8rem;
        color: #64748b;
      }
    }

    .queue {
      flex-shrink: 0;
      min-width: 48px;
      padding: 0.45rem 0.5rem;
      border-radius: 10px;
      background: #e0e7ff;
      color: #3730a3;
      font-weight: 700;
      text-align: center;
    }

    .bill-number {
      flex-shrink: 0;
      font-size: 0.72rem;
      font-weight: 600;
      color: #a16207;
    }

    .lines {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .line {
      padding: 0.75rem;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
    }

    .tariff {
      width: 100%;
    }

    .line-foot {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.5rem;

      strong {
        flex: 1;
        text-align: right;
        font-size: 0.9rem;
        color: #1e293b;
      }
    }

    .qty {
      display: flex;
      align-items: center;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;

      button {
        width: 34px;
        height: 34px;
        border: none;
        background: #f8fafc;
        color: #334155;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;

        &:disabled {
          color: #cbd5e1;
        }

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }

      input {
        width: 44px;
        height: 34px;
        border: none;
        text-align: center;
        font: inherit;
        font-size: 0.9rem;
        -moz-appearance: textfield;

        &::-webkit-outer-spin-button,
        &::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      }
    }

    .remove {
      border: none;
      background: none;
      color: #dc2626;
      cursor: pointer;
      padding: 0.25rem;
      display: flex;
    }

    .field-error {
      margin: 0.4rem 0 0;
      font-size: 0.78rem;
      color: #dc2626;
    }

    .auto-item {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.5rem 0;
      font-size: 0.85rem;
      color: #1e293b;

      & + .auto-item {
        border-top: 1px solid #f1f5f9;
      }

      div {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .type {
        font-size: 0.68rem;
        font-weight: 600;
        text-transform: uppercase;
        color: #9333ea;
      }

      .muted {
        font-size: 0.75rem;
      }
    }

    .totals .row {
      display: flex;
      justify-content: space-between;
      padding: 0.3rem 0;
      font-size: 0.88rem;
      color: #475569;

      &.discount {
        color: #dc2626;
      }

      &.grand {
        margin-top: 0.35rem;
        padding-top: 0.6rem;
        border-top: 1px dashed #e2e8f0;
        color: #1e293b;
        font-weight: 600;

        strong {
          font-size: 1.15rem;
        }
      }
    }

    .submit-error {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      margin: 0;
      padding: 0.75rem 1rem;
      border-radius: 12px;
      background: #fee2e2;
      color: #b91c1c;
      font-size: 0.85rem;

      mat-icon {
        flex-shrink: 0;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    .submit {
      height: 48px;
      margin-bottom: 1rem;

      mat-spinner {
        display: inline-block;
        margin-right: 0.5rem;
      }
    }

    .state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      text-align: center;
      color: #64748b;

      p {
        margin: 0;
      }

      &.error mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        color: #f87171;
      }
    }
  `],
})
export class BillEditComponent implements OnInit {
  private fb = inject(NonNullableFormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private billService = inject(BillService);
  private toastCtrl = inject(ToastController);

  /** Ada = mengubah tagihan yang sudah ada; tidak ada = membuat tagihan untuk kunjungan. */
  readonly billId = Number(this.route.snapshot.paramMap.get('id')) || null;
  readonly itemTypeLabels = BILL_ITEM_TYPE_LABELS;
  protected rupiah = formatRupiah;

  bill = signal<Bill | null>(null);
  visit = signal<Visit | null>((history.state?.visit as Visit | undefined) ?? null);
  visitId = signal<number | null>(Number(this.route.snapshot.paramMap.get('visitId')) || null);
  tariffs = signal<ServiceTariff[]>([]);

  isLoading = signal<boolean>(true);
  isSubmitting = signal<boolean>(false);
  loadError = signal<string | null>(null);
  submitError = signal<string | null>(null);
  private serverErrors = signal<Record<string, string[]>>({});

  form = this.fb.group({
    services: this.fb.array<ServiceLine>([]),
    discount: this.fb.control<number | null>(null, Validators.min(0)),
    notes: [''],
  });

  get services(): FormArray<ServiceLine> {
    return this.form.controls.services;
  }

  private formValue = toSignal(this.form.valueChanges.pipe(startWith(null), map(() => this.form.getRawValue())), {
    requireSync: true,
  });

  tariffGroups = computed<TariffGroup[]>(() => {
    const groups = new Map<string, TariffGroup>();
    for (const t of this.tariffs()) {
      const group = groups.get(t.category) ?? { label: t.category_label, tariffs: [] };
      group.tariffs.push(t);
      groups.set(t.category, group);
    }
    return [...groups.values()];
  });

  autoItems = computed(() => (this.bill()?.items ?? []).filter((i) => i.type !== 'service'));
  autoTotal = computed(() => this.autoItems().reduce((sum, i) => sum + i.subtotal, 0));
  servicesTotal = computed(() =>
    this.formValue().services.reduce((sum, line) => sum + this.priceOf(line.service_tariff_id) * (line.quantity || 0), 0),
  );
  discount = computed(() => Number(this.formValue().discount) || 0);
  estimatedTotal = computed(() => Math.max(this.servicesTotal() + this.autoTotal() - this.discount(), 0));

  ngOnInit() {
    this.load();
  }

  load() {
    this.isLoading.set(true);
    this.loadError.set(null);
    forkJoin({
      references: this.billService.references(),
      bill: this.billId ? this.billService.get(this.billId) : of(null),
    })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: ({ references, bill }) => {
          this.tariffs.set(references.service_tariffs);
          if (bill) this.applyBill(bill);
          else if (this.services.length === 0) this.addLine();
        },
        error: (err) => this.loadError.set(describeHttpError(err, 'Gagal memuat data tagihan.')),
      });
  }

  addLine(tariffId: number | null = null, quantity = 1) {
    this.services.push(
      this.fb.group({
        service_tariff_id: this.fb.control<number | null>(tariffId, Validators.required),
        quantity: this.fb.control(quantity, [Validators.required, Validators.min(1), Validators.max(1000)]),
      }),
    );
  }

  removeLine(index: number) {
    this.services.removeAt(index);
  }

  changeQty(index: number, delta: number) {
    const control = this.services.at(index).controls.quantity;
    control.setValue(Math.min(Math.max((control.value || 0) + delta, 1), 1000));
  }

  lineSubtotal(index: number): number {
    const line = this.formValue().services[index];
    return line ? this.priceOf(line.service_tariff_id) * (line.quantity || 0) : 0;
  }

  lineError(index: number): string | null {
    const errors = this.serverErrors();
    const server = errors[`services.${index}.service_tariff_id`]?.[0] ?? errors[`services.${index}.quantity`]?.[0];
    if (server) return server;
    const line = this.services.at(index);
    if (line.touched && line.controls.service_tariff_id.hasError('required')) return 'Pilih layanan.';
    if (line.controls.quantity.invalid) return 'Jumlah 1–1000.';
    return null;
  }

  fieldError(field: string): string | null {
    return this.serverErrors()[field]?.[0] ?? null;
  }

  onSubmit() {
    this.form.markAllAsTouched();
    this.submitError.set(null);
    if (this.form.invalid) {
      this.submitError.set('Periksa kembali layanan yang ditagihkan.');
      return;
    }
    const visitId = this.visitId();
    if (!visitId) return;

    const v = this.form.getRawValue();
    const body: BillUpsertRequest = {
      services: v.services.map((line) => ({ service_tariff_id: line.service_tariff_id!, quantity: line.quantity })),
      discount: Number(v.discount) || 0,
      notes: v.notes.trim() || undefined,
    };

    this.isSubmitting.set(true);
    this.serverErrors.set({});
    this.billService
      .upsert(visitId, body)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: async (res) => {
          await this.showToast(res.message, 'success');
          this.router.navigate(['/main/bills', res.data.id], { replaceUrl: true });
        },
        error: (err) => {
          const errors = validationErrors(err);
          this.serverErrors.set(errors);
          if (errors['discount']) this.form.controls.discount.setErrors({ server: true });
          this.submitError.set(describeHttpError(err, 'Gagal menyimpan tagihan.'));
        },
      });
  }

  private applyBill(bill: Bill) {
    this.bill.set(bill);
    if (bill.visit) {
      this.visit.set(bill.visit);
      this.visitId.set(bill.visit.id);
    }
    this.services.clear();
    for (const item of bill.items ?? []) {
      if (item.type === 'service' && item.service_tariff_id) this.addLine(item.service_tariff_id, item.quantity);
    }
    this.form.patchValue({ discount: bill.discount || null, notes: bill.notes ?? '' });
  }

  private priceOf(tariffId: number | null): number {
    return this.tariffs().find((t) => t.id === tariffId)?.price ?? 0;
  }

  private async showToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'bottom',
      positionAnchor: 'main-tab-bar',
      color,
    });
    await toast.present();
  }
}
