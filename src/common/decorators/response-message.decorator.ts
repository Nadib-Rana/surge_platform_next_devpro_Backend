/**
 * src/common/decorators/response-message.decorator.ts
 * * Defines a custom decorator to set a success message
 * * for a controller route.
 */

import { SetMetadata } from "@nestjs/common";

export const RESPONSE_MESSAGE_KEY = "responseMessage";

/**
 * Decorator that sets a custom success message for a response.
 * This message will be picked up by the ResponseStandardizationInterceptor.
 *
 * @example
 * @ResponseMessage("User created successfully")
 * @Post()
 * createUser(@Body() user: CreateUserDto) {
 * return this.userService.create(user);
 * }
 */
export const ResponseMessage = (message: string) =>
  SetMetadata(RESPONSE_MESSAGE_KEY, message);
