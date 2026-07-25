import { Injectable } from "@nestjs/common";
import {
  BaseDispatcher,
  DispatchPayload,
  DispatchResult,
} from "./interfaces/base-dispatcher.interface";
import { WordpressStrategy } from "./strategies/wordpress.strategy";
import { LinkedinStrategy } from "./strategies/linkedin.strategy";
import { FacebookStrategy } from "./strategies/facebook.strategy";
import { formatPayloadForPlatform } from "./helpers/dispatch-formatter.util";
import { refreshOAuthTokenIfNeeded } from "../publishing-channels/oauth/oauth-token-refresh.helper";

@Injectable()
export class DispatcherService {
  private strategies: BaseDispatcher[];

  constructor() {
    this.strategies = [
      new WordpressStrategy(),
      new LinkedinStrategy(),
      new FacebookStrategy(),
    ];
  }

  async dispatch(payload: DispatchPayload): Promise<DispatchResult> {
    const formattedPayload = formatPayloadForPlatform(payload);
    const channel = formattedPayload.channel;

    const strategy = this.strategies.find((s) => s.handles(channel));
    if (!strategy) {
      return {
        success: false,
        error: `No dispatcher configured for channel: ${channel}`,
      };
    }

    const result = await strategy.dispatch(formattedPayload);

    if (!result.success && result.error?.includes("401")) {
      const refreshedCreds = await refreshOAuthTokenIfNeeded(
        channel,
        formattedPayload.credentials,
      );

      if (refreshedCreds) {
        return strategy.dispatch({
          ...formattedPayload,
          credentials: refreshedCreds,
        });
      }
    }

    return result;
  }

  registerStrategy(strategy: BaseDispatcher) {
    this.strategies.push(strategy);
  }
}
