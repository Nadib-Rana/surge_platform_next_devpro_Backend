import { Injectable } from "@nestjs/common";
import { UnauthorizedException } from "./common/exceptions/http.exceptions";

@Injectable()
export class AppService {
  getHello(): string {
    throw new UnauthorizedException(
      "Your session has expired.", // 1. message
      false, // 2. isVerified (এটিই আপনি মিস করেছিলেন)
      "SESSION_EXPIRED", // 3. code
      undefined, // 4. errors
      "LOGOUT_USER", // 5. instruction
      { needOtpVerification: true }, // 6. details
    );
  }
}
