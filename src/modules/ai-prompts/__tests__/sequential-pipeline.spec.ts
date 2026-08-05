import { validateHyperlinksPreservation } from "../helpers/hyperlink-validator";
import { GeminiImageProvider } from "../providers/gemini-image-provider.service";
import { ConfigService } from "@nestjs/config";

describe("8-Step Sequential Pipeline Components", () => {
  describe("Hyperlink Validator", () => {
    it("should pass when all hyperlinks are preserved exactly", () => {
      const raw = `<p>Check out our <a href="https://example.com/pricing">pricing</a> page.</p>`;
      const polished = `<p>Review the <a href="https://example.com/pricing">pricing</a> details.</p>`;

      const validation = validateHyperlinksPreservation(raw, polished);
      expect(validation.valid).toBe(true);
      expect(validation.missingLinks.length).toBe(0);
    });

    it("should fail when a hyperlink is missing", () => {
      const raw = `<p>Check out our <a href="https://example.com/pricing">pricing</a> page.</p>`;
      const polished = `<p>Review the pricing details.</p>`;

      const validation = validateHyperlinksPreservation(raw, polished);
      expect(validation.valid).toBe(false);
      expect(validation.missingLinks).toContain("https://example.com/pricing");
    });

    it("should fail when a hyperlink is altered", () => {
      const raw = `<p>Check out our <a href="https://example.com/pricing">pricing</a> page.</p>`;
      const polished = `<p>Review the <a href="https://example.com/pricing-plans">pricing</a> details.</p>`;

      const validation = validateHyperlinksPreservation(raw, polished);
      expect(validation.valid).toBe(false);
      expect(validation.alteredLinks.length).toBeGreaterThan(0);
    });
  });

  describe("Gemini Image Provider", () => {
    it("should invoke API and return buffer (mocked)", async () => {
      const mockConfig = {
        get: jest.fn().mockImplementation((key: string) => {
          if (key === "GEMINI_API_KEY") return "mock-key";
          return null;
        }),
      } as unknown as ConfigService;

      const provider = new GeminiImageProvider(mockConfig);

      const mockBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
      const mockJson = {
        generatedImages: [{ image: { imageBytes: mockBase64 } }],
      };

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockJson),
      });
      global.fetch = mockFetch;

      const buffer = await provider.generateImage({
        prompt: "A witty cartoon prompt",
        negativeConstraints: "color, photo",
        temperature: 0.4,
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString("base64")).toBe(mockBase64);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
