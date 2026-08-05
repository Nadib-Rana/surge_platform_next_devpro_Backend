import { interpolateTemplate } from "../helpers/ai-prompts-digest.helper";

describe("interpolateTemplate", () => {
  it("interpolates {{...}} placeholders correctly", () => {
    const template = "You are {{companyName}}'s content analyst. Review {{articleContext}}.";
    const result = interpolateTemplate(template, {
      companyName: "Zerodraft AI",
      articleContext: "Healthcare news",
    });
    expect(result).toBe("You are Zerodraft AI's content analyst. Review Healthcare news.");
  });

  it("interpolates [...] placeholders correctly", () => {
    const template = "You are [Company/Brand Name] ([Company Website]). Review news for [Industry].";
    const result = interpolateTemplate(template, {
      companyName: "Zerodraft AI",
      companyWebsite: "https://zerodraft.ai",
      industry: "Healthcare IT",
    });
    expect(result).toBe("You are Zerodraft AI (https://zerodraft.ai). Review news for Healthcare IT.");
  });

  it("handles mixed {{...}} and [...] placeholders seamlessly", () => {
    const template = "Company: [Company/Brand Name]\nSite: {{companyWebsite}}\nTopic: [Brand Topic List]";
    const result = interpolateTemplate(template, {
      companyName: "Acme Corp",
      companyWebsite: "https://acme.com",
      brandTopicList: "SaaS & AI",
    });
    expect(result).toBe("Company: Acme Corp\nSite: https://acme.com\nTopic: SaaS & AI");
  });
});
