import {
  Directive,
  EmbeddedViewRef,
  Input,
  OnChanges,
  OnDestroy,
  Optional,
  SkipSelf,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { Subject } from 'rxjs';
import { filter, startWith, takeUntil } from 'rxjs/operators';
import { parseKeys } from './internals';
import { ContextProviderComponent } from './provider.component';

export class Context {
  $implicit: { [key: string]: any } = {};
}

@Directive({
  selector: '[contextDisposer]',
})
export class ContextDisposerDirective implements OnChanges, OnDestroy {
  private destroy$ = new Subject<void>();
  private _dispose: string | string[] = '';
  private view: EmbeddedViewRef<any>;

  @Input('contextDisposer')
  set dispose(dispose: string | string[]) {
    this._dispose = dispose || '';
  }
  get dispose(): string | string[] {
    return this._dispose;
  }

  constructor(
    @Optional()
    private tempRef: TemplateRef<any>,
    @Optional()
    private vcRef: ViewContainerRef,
    @Optional()
    @SkipSelf()
    private provider: ContextProviderComponent,
  ) {}

  private init(): void {
    const disposed: string[] = parseKeys(this.dispose);

    this.provider.reset$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.ngOnChanges());

    if (this.provider.provide.length)
      this.provider.change$
        .pipe(
          takeUntil(this.destroy$),
          startWith(...Array.from(this.provider.provided.keys())),
          filter(key => !!key),
        )
        .subscribe(providerKey => this.syncProperties(disposed, providerKey));
  }

  private reset(): void {
    this.view = this.vcRef.createEmbeddedView(this.tempRef, new Context());
  }

  private syncProperties(disposed: string[], providerKey: string): void {
    const key = this.provider.contextMap[providerKey] || providerKey;

    if (disposed.length && disposed.indexOf(key) < 0) return;

    const value = this.provider.component[providerKey];

    this.view.context.$implicit[key] = value;
    this.view.context[key] = value;
    this.view.markForCheck();
  }

  ngOnChanges() {
    this.ngOnDestroy();
    this.reset();

    if (this.provider && this.tempRef && this.vcRef) this.init();
  }

  ngOnDestroy() {
    this.destroy$.next();

    if (this.view) this.vcRef.clear();
  }
}
