import axios from "axios";

export function formatHealthError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.response?.statusText ||
      error.message
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error occurred";
}
