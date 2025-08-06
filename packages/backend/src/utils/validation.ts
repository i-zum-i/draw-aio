import { z } from 'zod';

// Validation schema for diagram generation request
export const diagramRequestSchema = z.object({
  prompt: z
    .string()
    .min(1, 'プロンプトは必須です')
    .max(10000, 'プロンプトは10,000文字以内で入力してください')
    .refine(
      (value) => value.trim().length > 0,
      'プロンプトは空白のみでは無効です'
    )
    .transform((value) => value.trim()),
});

export type DiagramRequestValidated = z.infer<typeof diagramRequestSchema>;

// Sanitization function to remove potentially harmful characters
export const sanitizeText = (text: string): string => {
  return text
    // Remove script tags content first
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove potentially dangerous characters for XML
    .replace(/[<>&"']/g, (match) => {
      const entityMap: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entityMap[match] || match;
    })
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
};

// Validation error class
export class ValidationError extends Error {
  public issues: z.ZodIssue[];

  constructor(issues: z.ZodIssue[]) {
    const message = issues.map(issue => issue.message).join(', ');
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}