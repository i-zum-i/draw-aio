import { diagramRequestSchema, sanitizeText, ValidationError } from '../validation';

describe('Validation Utils', () => {
  describe('diagramRequestSchema', () => {
    it('should validate valid prompt', () => {
      const validData = { prompt: 'Create a flowchart for user registration' };
      const result = diagramRequestSchema.parse(validData);
      expect(result.prompt).toBe('Create a flowchart for user registration');
    });

    it('should trim whitespace from prompt', () => {
      const dataWithWhitespace = { prompt: '  Create a diagram  ' };
      const result = diagramRequestSchema.parse(dataWithWhitespace);
      expect(result.prompt).toBe('Create a diagram');
    });

    it('should reject empty prompt', () => {
      const emptyData = { prompt: '' };
      expect(() => diagramRequestSchema.parse(emptyData)).toThrow();
    });

    it('should reject prompt with only whitespace', () => {
      const whitespaceData = { prompt: '   ' };
      expect(() => diagramRequestSchema.parse(whitespaceData)).toThrow();
    });

    it('should reject prompt that is too long', () => {
      const longPrompt = 'a'.repeat(10001);
      const longData = { prompt: longPrompt };
      expect(() => diagramRequestSchema.parse(longData)).toThrow();
    });
  });

  describe('sanitizeText', () => {
    it('should remove HTML tags', () => {
      const input = 'Hello <script>alert("xss")</script> world';
      const result = sanitizeText(input);
      expect(result).toBe('Hello world');
    });

    it('should escape XML special characters', () => {
      const input = 'Test <tag> & "quotes" & \'apostrophes\'';
      const result = sanitizeText(input);
      expect(result).toBe('Test &amp; &quot;quotes&quot; &amp; &#39;apostrophes&#39;');
    });

    it('should normalize whitespace', () => {
      const input = 'Multiple   spaces\n\nand\t\ttabs';
      const result = sanitizeText(input);
      expect(result).toBe('Multiple spaces and tabs');
    });

    it('should handle empty string', () => {
      const result = sanitizeText('');
      expect(result).toBe('');
    });
  });
});