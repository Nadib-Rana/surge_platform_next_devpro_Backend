import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";
import { ResponseMessage } from "./common/decorators/response-message.decorator";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ResponseMessage("Hello ASAP!")
  getHello(): string {
    return this.appService.getHello();
  }
}
