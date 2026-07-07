import { Injectable } from "@nestjs/common";
import {
  BaseDispatcher,
  DispatchPayload,
  DispatchResult,
} from "./interfaces/base-dispatcher.interface";
import { WordpressStrategy } from "./strategies/wordpress.strategy";
import { LinkedinStrategy } from "./strategies/linkedin.strategy";
import { FacebookStrategy } from "./strategies/facebook.strategy";

@Injectable()
export class DispatcherService {
  private strategies: BaseDispatcher[];

  constructor() {
    // instantiate strategies explicitly to keep DI surface minimal and isolate SDKs
    this.strategies = [
      new WordpressStrategy(),
      new LinkedinStrategy(),
      new FacebookStrategy(),
    ];
  }

  async dispatch(payload: DispatchPayload): Promise<DispatchResult> {
    const channel = payload.channel;
    const strategy = this.strategies.find((s) => s.handles(channel));
    if (!strategy)
      return {
        success: false,
        error: `No dispatcher configured for channel: ${channel}`,
      };
    return strategy.dispatch(payload);
  }

  registerStrategy(strategy: BaseDispatcher) {
    // Allow runtime extension
    this.strategies.push(strategy);
  }
}
