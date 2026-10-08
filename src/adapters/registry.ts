import type { UpstreamAdapter } from './interface';
import { HttpUpstreamAdapter, type HttpAdapterConfig } from './http-adapter';
import { SmsbaoAdapter, type SmsbaoAdapterConfig } from './smsbao-adapter';

export class AdapterRegistry {
  private adapters = new Map<string, UpstreamAdapter>();

  register(upstreamCode: string, adapter: UpstreamAdapter): void {
    this.adapters.set(upstreamCode, adapter);
  }

  get(upstreamCode: string): UpstreamAdapter | undefined {
    return this.adapters.get(upstreamCode);
  }

  loadFromConfig(upstreamCode: string, adapterType: string, configJson: string): void {
    if (adapterType === 'http') {
      const config = JSON.parse(configJson) as HttpAdapterConfig;
      this.register(upstreamCode, new HttpUpstreamAdapter(config));
    } else if (adapterType === 'smsbao') {
      const config = JSON.parse(configJson) as SmsbaoAdapterConfig;
      this.register(upstreamCode, new SmsbaoAdapter(config));
    }
  }
}
