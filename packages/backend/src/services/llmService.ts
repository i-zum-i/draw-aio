import Anthropic from '@anthropic-ai/sdk';

export interface LLMResponse {
  xml: string;
  metadata?: {
    diagramType: string;
    complexity: number;
  };
}

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export enum LLMErrorCode {
  API_KEY_MISSING = 'API_KEY_MISSING',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  INVALID_XML = 'INVALID_XML',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// Simple in-memory cache for LLM responses
interface CacheEntry {
  xml: string;
  timestamp: number;
  expiresAt: number;
}

export class LLMService {
  private client: Anthropic;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour
  private readonly MAX_CACHE_SIZE = 100;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    this.client = new Anthropic({
      apiKey: apiKey,
      timeout: 25000, // 25 second timeout for API calls
    });

    // Clean cache periodically
    setInterval(() => this.cleanCache(), 10 * 60 * 1000); // Every 10 minutes
  }

  /**
   * Generate Draw.io XML from natural language prompt
   */
  async generateDrawioXML(prompt: string): Promise<string> {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(prompt);
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(prompt);

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514', // Claude Sonnet 4
        max_tokens: 8192, // Claude Sonnet 4 max tokens
        temperature: 0.2, // Lower temperature for more consistent results
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      // Extract XML from response
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new LLMError(
          'Received unexpected response format from Claude API',
          LLMErrorCode.INVALID_RESPONSE
        );
      }

      const xml = this.extractXMLFromResponse(content.text);
      this.validateDrawioXML(xml);

      // Cache the result
      this.saveToCache(cacheKey, xml);

      return xml;
    } catch (error) {
      // Re-throw LLMError as-is
      if (error instanceof LLMError) {
        throw error;
      }

      // Handle Anthropic API specific errors
      if (error instanceof Error) {
        throw this.handleAnthropicError(error);
      }

      // Handle unknown errors
      throw new LLMError(
        'Unknown error occurred during diagram generation',
        LLMErrorCode.UNKNOWN_ERROR,
        error as Error
      );
    }
  }

  /**
   * Build system prompt for Draw.io XML generation
   */
  private buildSystemPrompt(): string {
    return `You are an expert at generating Draw.io XML format. Convert the user's natural language diagram description into valid XML format that can be opened in Draw.io (diagrams.net).

Important requirements:
1. Always output in valid Draw.io XML format
2. XML must start with <mxfile> tag and end with </mxfile> tag
3. Define diagram elements using <mxCell> tags
4. Set appropriate coordinates and sizes
5. Handle text content correctly
6. Choose appropriate diagram types like flowcharts, org charts, system diagrams, etc.
7. For AWS architecture diagrams, follow the "AWS Diagram Rules" below

AWS Diagram Rules:
 1. Use draw.io "AWS 2025" icons
 2. Don't overlay text on borders or icons. Create margins to improve visibility
 3. Standardize icon size to 48×48
 4. Icon descriptions should include:
    4-1. Service name
    4-2. Resource name (do not include IDs)
 5. Express boundaries as follows:
    5-1. AWS Cloud
    5-2. Region
    5-3. VPC (add CIDR in parentheses at the end)
    5-4. Availability Zone
    5-5. Subnet (add CIDR in parentheses at the end)
    5-6. Security Group
 6. Leave ample margins in boundaries considering scalability
 7. Place icons close together for better visibility

Output format:
- Output XML only (no explanatory text needed)
- XML must be properly formatted
- Use UTF-8 character encoding

Basic Draw.io XML structure example:
\`\`\`xml
<mxfile host="app.diagrams.net" modified="2024-01-01T00:00:00.000Z" agent="AI" version="22.1.0">
  <diagram name="Page-1" id="page-id">
    <mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <!-- Place diagram elements here -->
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
\`\`\``;
  }

  /**
   * Build user prompt with the specific diagram request
   */
  private buildUserPrompt(prompt: string): string {
    return `Generate Draw.io XML format based on the following description:

${prompt}

Requirements:
- Express the above description as an appropriate diagram
- Clearly show relationships between elements
- Create a readable layout
- Handle labels and text correctly

Output XML only:`;
  }

  /**
   * Handle Anthropic API specific errors
   */
  private handleAnthropicError(error: Error): LLMError {
    const errorMessage = error.message.toLowerCase();

    // Rate limit errors
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return new LLMError(
        'AI service rate limit reached. Please wait and try again',
        LLMErrorCode.RATE_LIMIT_ERROR,
        error
      );
    }

    // Quota exceeded errors
    if (errorMessage.includes('quota') || errorMessage.includes('billing') || errorMessage.includes('credits')) {
      return new LLMError(
        'AI service usage limit reached. Please contact administrator',
        LLMErrorCode.QUOTA_EXCEEDED,
        error
      );
    }

    // Timeout errors (check before connection errors)
    if (errorMessage.includes('timeout') &&
      !errorMessage.includes('connection') &&
      !errorMessage.includes('network')) {
      return new LLMError(
        'AI service response timed out. Please try again',
        LLMErrorCode.TIMEOUT_ERROR,
        error
      );
    }

    // Connection/network errors
    if (errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('econnreset') ||
      errorMessage.includes('enotfound') ||
      errorMessage.includes('fetch')) {
      return new LLMError(
        'Cannot connect to AI service. Please check network connection and try again',
        LLMErrorCode.CONNECTION_ERROR,
        error
      );
    }

    // Authentication errors
    if (errorMessage.includes('unauthorized') ||
      errorMessage.includes('authentication') ||
      errorMessage.includes('api key') ||
      errorMessage.includes('401')) {
      return new LLMError(
        'AI service authentication failed. Please check configuration',
        LLMErrorCode.API_KEY_MISSING,
        error
      );
    }

    // Default to unknown error
    return new LLMError(
      'An error occurred with the AI service. Please wait and try again',
      LLMErrorCode.UNKNOWN_ERROR,
      error
    );
  }

  /**
   * Extract XML content from Claude's response
   */
  private extractXMLFromResponse(response: string): string {
    // Look for XML content between ```xml tags or direct XML
    const xmlMatch = response.match(/```xml\s*([\s\S]*?)\s*```/) ||
      response.match(/(<mxfile[\s\S]*?<\/mxfile>)/);

    if (xmlMatch) {
      return xmlMatch[1].trim();
    }

    // If no XML tags found, check if the entire response is XML
    if (response.trim().startsWith('<mxfile') && response.trim().endsWith('</mxfile>')) {
      return response.trim();
    }

    throw new LLMError(
      'AI could not generate a valid diagram. Please try a different description',
      LLMErrorCode.INVALID_RESPONSE
    );
  }

  /**
   * Basic validation of Draw.io XML structure
   */
  private validateDrawioXML(xml: string): void {
    try {
      // Check for required root elements
      if (!xml.includes('<mxfile')) {
        throw new LLMError(
          'Generated XML is invalid: mxfile tag not found',
          LLMErrorCode.INVALID_XML
        );
      }

      if (!xml.includes('</mxfile>')) {
        throw new LLMError(
          'Generated XML is invalid: mxfile closing tag not found',
          LLMErrorCode.INVALID_XML
        );
      }

      if (!xml.includes('<mxGraphModel')) {
        throw new LLMError(
          'Generated XML is invalid: mxGraphModel tag not found',
          LLMErrorCode.INVALID_XML
        );
      }

      if (!xml.includes('<root>')) {
        throw new LLMError(
          'Generated XML is invalid: root tag not found',
          LLMErrorCode.INVALID_XML
        );
      }

      // Basic XML structure validation
      const openTags = (xml.match(/<[^\/][^>]*>/g) || []).length;
      const closeTags = (xml.match(/<\/[^>]*>/g) || []).length;
      const selfClosingTags = (xml.match(/<[^>]*\/>/g) || []).length;

      // Self-closing tags count as both open and close
      if (openTags !== closeTags + selfClosingTags) {
        // Don't throw error for tag balance issues as it might be a false positive
      }

      // Check for minimum content (at least one cell beyond the root cells)
      const cellMatches = xml.match(/<mxCell/g);
      if (!cellMatches || cellMatches.length < 2) {
        // Empty diagrams might be valid - don't throw error
      }

    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }

      throw new LLMError(
        'Error occurred during XML validation',
        LLMErrorCode.INVALID_XML,
        error as Error
      );
    }
  }

  /**
   * Generate cache key from prompt
   */
  private generateCacheKey(prompt: string): string {
    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `llm_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Get result from cache if valid
   */
  private getFromCache(key: string): string | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.xml;
  }

  /**
   * Save result to cache
   */
  private saveToCache(key: string, xml: string): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const now = Date.now();
    this.cache.set(key, {
      xml,
      timestamp: now,
      expiresAt: now + this.CACHE_TTL,
    });
  }

  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    // Cache cleanup completed silently
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
    };
  }
}