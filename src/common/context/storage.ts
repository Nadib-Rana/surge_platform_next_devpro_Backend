/**
 * src/common/context/storage.ts
 * * Creates and exports the AsyncLocalStorage instance.
 * This will store our request-scoped context, like the request ID.
 */
import { AsyncLocalStorage } from "async_hooks";

// The store will hold a Map, where we can store
// request-scoped values.
export type RequestContextStore = Map<string, any>;

export const requestContext = new AsyncLocalStorage<RequestContextStore>();
