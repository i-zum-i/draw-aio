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
        console.log('🎯 Cache hit for prompt');
        return cachedResult;
      }

      console.log('🔄 Generating new diagram from LLM...');
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(prompt);

      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307', // Using Haiku for faster responses
        max_tokens: 3000, // Reduced for better performance
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
          'Claude APIから予期しないレスポンス形式を受信しました',
          LLMErrorCode.INVALID_RESPONSE
        );
      }

      const xml = this.extractXMLFromResponse(content.text);
      this.validateDrawioXML(xml);

      // Cache the result
      this.saveToCache(cacheKey, xml);
      console.log('💾 Cached LLM response');

      return xml;
    } catch (error) {
      console.error('Error generating Draw.io XML:', error);
      
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
        '図生成中に不明なエラーが発生しました',
        LLMErrorCode.UNKNOWN_ERROR,
        error as Error
      );
    }
  }

  /**
   * Build system prompt for Draw.io XML generation
   */
  private buildSystemPrompt(): string {
    return `あなたはDraw.io形式のXMLを生成する専門家です。ユーザーの自然言語による図の説明を、Draw.io（diagrams.net）で開ける有効なXML形式に変換してください。

重要な要件:
1. 必ず有効なDraw.io XML形式で出力してください
2. XMLは<mxfile>タグで始まり</mxfile>タグで終わる必要があります
3. 図の要素は<mxCell>タグを使用して定義してください
4. 適切な座標とサイズを設定してください
5. 日本語テキストを正しく処理してください
6. フローチャート、組織図、システム図など、適切な図の種類を選択してください

出力形式:
- XMLのみを出力してください（説明文は不要）
- XMLは整形されている必要があります
- 文字エンコーディングはUTF-8を使用してください

Draw.io XMLの基本構造例:
\`\`\`xml
<mxfile host="app.diagrams.net" modified="2024-01-01T00:00:00.000Z" agent="AI" version="22.1.0">
  <diagram name="Page-1" id="page-id">
    <mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <!-- 図の要素をここに配置 -->
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
    return `以下の説明に基づいて、Draw.io形式のXMLを生成してください：

${prompt}

要求:
- 上記の説明を適切な図として表現してください
- 要素間の関係を明確に示してください
- 読みやすいレイアウトにしてください
- 日本語のラベルやテキストを正しく処理してください

XMLのみを出力してください：`;
  }

  /**
   * Handle Anthropic API specific errors
   */
  private handleAnthropicError(error: Error): LLMError {
    const errorMessage = error.message.toLowerCase();

    // Rate limit errors
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return new LLMError(
        'AI サービスのレート制限に達しました。しばらく待ってから再試行してください',
        LLMErrorCode.RATE_LIMIT_ERROR,
        error
      );
    }

    // Quota exceeded errors
    if (errorMessage.includes('quota') || errorMessage.includes('billing') || errorMessage.includes('credits')) {
      return new LLMError(
        'AI サービスの利用制限に達しました。管理者にお問い合わせください',
        LLMErrorCode.QUOTA_EXCEEDED,
        error
      );
    }

    // Timeout errors (check before connection errors)
    if (errorMessage.includes('timeout') && 
        !errorMessage.includes('connection') && 
        !errorMessage.includes('network')) {
      return new LLMError(
        'AI サービスの応答がタイムアウトしました。再試行してください',
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
        'AI サービスに接続できません。ネットワーク接続を確認してから再試行してください',
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
        'AI サービスの認証に失敗しました。設定を確認してください',
        LLMErrorCode.API_KEY_MISSING,
        error
      );
    }

    // Default to unknown error
    return new LLMError(
      'AI サービスでエラーが発生しました。しばらく待ってから再試行してください',
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
      'AI が有効な図を生成できませんでした。別の説明を試してください',
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
          '生成されたXMLが無効です: mxfileタグが見つかりません',
          LLMErrorCode.INVALID_XML
        );
      }

      if (!xml.includes('</mxfile>')) {
        throw new LLMError(
          '生成されたXMLが無効です: mxfile終了タグが見つかりません',
          LLMErrorCode.INVALID_XML
        );
      }

      if (!xml.includes('<mxGraphModel')) {
        throw new LLMError(
          '生成されたXMLが無効です: mxGraphModelタグが見つかりません',
          LLMErrorCode.INVALID_XML
        );
      }

      if (!xml.includes('<root>')) {
        throw new LLMError(
          '生成されたXMLが無効です: rootタグが見つかりません',
          LLMErrorCode.INVALID_XML
        );
      }

      // Basic XML structure validation
      const openTags = (xml.match(/<[^\/][^>]*>/g) || []).length;
      const closeTags = (xml.match(/<\/[^>]*>/g) || []).length;
      const selfClosingTags = (xml.match(/<[^>]*\/>/g) || []).length;
      
      // Self-closing tags count as both open and close
      if (openTags !== closeTags + selfClosingTags) {
        console.warn('XML tag balance warning - may indicate malformed XML');
        // Don't throw error for tag balance issues as it might be a false positive
      }

      // Check for minimum content (at least one cell beyond the root cells)
      const cellMatches = xml.match(/<mxCell/g);
      if (!cellMatches || cellMatches.length < 2) {
        console.warn('XML appears to have minimal content - may be empty diagram');
        // Don't throw error as empty diagrams might be valid
      }

    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }
      
      throw new LLMError(
        'XMLの検証中にエラーが発生しました',
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

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned ${cleanedCount} expired cache entries`);
    }
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