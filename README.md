# AI図表生成システム

自然言語の説明からDraw.io形式の図表を自動生成するAI搭載Webアプリケーションです。

## プロジェクト概要

本システムは、ユーザーが日本語で図表の内容を説明するだけで、編集可能な.drawioファイルとPNG画像を自動生成するWebアプリケーションです。大規模言語モデル（Claude）を活用してユーザーの意図を解釈し、適切な視覚的表現を生成することで、ビジネス図や技術図の作成にかかる時間と労力を大幅に削減します。

### 主な特徴

- **自然言語入力**: 日本語で図表の内容を説明するだけで図を生成
- **即座のプレビュー**: 生成されたPNG画像をブラウザで即座に確認
- **編集可能ファイル**: Draw.ioで開いて編集できる.drawioファイルをダウンロード
- **ログイン不要**: 認証なしで誰でもすぐに利用可能
- **レスポンシブ対応**: PC・タブレット・スマートフォンで利用可能

## プロジェクト構成

TypeScriptモノレポ構成で、フロントエンドとバックエンドを統合管理しています：

```
ai-diagram-generator/
├── packages/
│   ├── backend/                    # mastraベースのAPIサーバー
│   │   ├── src/
│   │   │   ├── controllers/        # APIエンドポイント
│   │   │   ├── services/           # ビジネスロジック
│   │   │   │   ├── llmService.ts   # Claude LLM連携
│   │   │   │   ├── fileService.ts  # ファイル管理
│   │   │   │   └── imageService.ts # PNG画像生成
│   │   │   ├── middleware/         # パフォーマンス・セキュリティ
│   │   │   ├── types/              # TypeScript型定義
│   │   │   └── utils/              # ユーティリティ関数
│   │   └── package.json
│   └── frontend/                   # Next.js Reactアプリ
│       ├── src/
│       │   ├── app/                # Next.js App Router
│       │   ├── components/         # Reactコンポーネント
│       │   │   ├── MainPage.tsx    # メイン画面
│       │   │   ├── InputForm.tsx   # 入力フォーム
│       │   │   ├── ResultDisplay.tsx # 結果表示
│       │   │   └── ErrorMessage.tsx  # エラー処理
│       │   ├── hooks/              # カスタムフック
│       │   ├── types/              # TypeScript型定義
│       │   └── utils/              # ユーティリティ関数
│       └── package.json
├── scripts/                        # デプロイメントスクリプト
├── docker-compose.yml              # 開発環境用Docker設定
├── docker-compose.prod.yml         # 本番環境用Docker設定
├── Dockerfile                      # マルチステージDockerビルド
└── nginx.conf                      # リバースプロキシ設定
```

## 技術スタック

### フロントエンド
- **React 18** - UIライブラリ
- **Next.js 14** - Reactフレームワーク（App Router使用）
- **TypeScript** - 型安全な開発
- **CSS-in-JS** - スタイリング（styled-jsx使用）

### バックエンド
- **Node.js 18+** - サーバーランタイム
- **mastra** - LLMアプリケーション構築フレームワーク
- **Express.js** - Webフレームワーク
- **TypeScript** - 型安全な開発

### AI・図表生成
- **Claude (Anthropic)** - 自然言語処理・XML生成
- **Draw.io CLI** - PNG画像変換
- **Zod** - データバリデーション

### インフラ・デプロイ
- **Docker & Docker Compose** - コンテナ化
- **Nginx** - リバースプロキシ・ロードバランサー
- **Jest** - テストフレームワーク

## 開発環境のセットアップ

### 前提条件

- Node.js 18以上
- npm 9以上
- Draw.io CLI（PNG変換用）
- Docker & Docker Compose（本番環境用）

### インストール手順

1. **リポジトリのクローン**:
```bash
git clone <repository-url>
cd ai-diagram-generator
```

2. **依存関係のインストール**:
```bash
npm install
npm install --workspaces
```

3. **環境変数の設定**:
```bash
# バックエンド環境変数
cp packages/backend/.env.example packages/backend/.env
# packages/backend/.env を編集してANTHROPIC_API_KEYを設定

# フロントエンド環境変数
cp packages/frontend/.env.example packages/frontend/.env
```

4. **Draw.io CLIのインストール**:
```bash
npm install -g @drawio/drawio-desktop-cli
```

5. **開発サーバーの起動**:
```bash
npm run dev
```

アプリケーションは以下のURLでアクセス可能です：
- フロントエンド: http://localhost:3000
- バックエンドAPI: http://localhost:3001

### 個別起動

```bash
# バックエンドのみ
npm run dev:backend

# フロントエンドのみ
npm run dev:frontend
```

## ビルドとテスト

### 開発用ビルド
```bash
npm run build
```

### 本番用ビルド
```bash
npm run build:production
```

### テスト実行
```bash
# 全テスト実行
npm test

# カバレッジ付きテスト
npm run test:coverage

# 型チェック
npm run typecheck

# リンティング
npm run lint
```

## 本番環境デプロイ

### Dockerを使用したデプロイ

1. **本番環境のセットアップ**:
```bash
# Linux/Mac
./scripts/setup-production.sh

# Windows
.\scripts\setup-production.ps1
```

2. **環境変数の設定**:
```bash
# .env ファイルを編集
ANTHROPIC_API_KEY=your_actual_api_key
FRONTEND_URL=https://your-domain.com
NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

3. **デプロイ実行**:
```bash
# Linux/Mac
./scripts/deploy.sh

# Windows
.\scripts\deploy.ps1
```

### 利用可能なスクリプト

#### 開発用
- `npm run dev` - 開発サーバー起動
- `npm run build` - 開発用ビルド
- `npm run test` - テスト実行
- `npm run lint` - リンティング実行

#### 本番用
- `npm run build:production` - 本番用ビルド
- `npm run start:production` - 本番サーバー起動
- `npm run validate` - 型チェック・リント・テストの一括実行
- `npm run typecheck` - TypeScript型チェック

## パフォーマンス最適化

本プロジェクトには以下の最適化機能が含まれています：

### フロントエンド最適化
- **バンドルサイズ最適化**: Next.js最適化機能、webpack bundle analyzer
- **画像読み込み最適化**: 遅延読み込み、プログレッシブ読み込み、最適化画像コンポーネント
- **レスポンシブ対応**: モバイルファースト設計

### バックエンド最適化
- **APIレスポンス最適化**: LLMレスポンスキャッシュ、レート制限、圧縮
- **パフォーマンス監視**: レスポンス時間測定、メモリ使用量監視
- **エラーハンドリング**: 包括的なエラー処理とユーザーフレンドリーなメッセージ

### セキュリティ
- **セキュリティヘッダー**: Helmet、CORS、CSP設定
- **レート制限**: API呼び出し制限
- **入力検証**: Zodによるデータバリデーション

### 監視・ログ
- **ヘルスチェック**: サービス稼働状況監視
- **パフォーマンスログ**: 処理時間・エラー率の記録
- **メモリ監視**: メモリ使用量の追跡

## システム機能

### 主要機能

1. **図表作成指示機能**
   - 日本語自然言語による図表内容の入力
   - リアルタイム入力検証
   - 処理状況の可視化

2. **AI図表生成機能**
   - Claude LLMによる自然言語解釈
   - Draw.io互換XML生成
   - エラーハンドリングと再試行機能

3. **画像プレビュー機能**
   - PNG画像の即座生成・表示
   - 最適化された画像読み込み
   - レスポンシブ画像表示

4. **ファイルダウンロード機能**
   - 編集可能な.drawioファイル提供
   - 一時URL生成によるセキュアなダウンロード
   - ファイル管理とクリーンアップ

### 対応図表タイプ

- フローチャート
- 組織図
- システム構成図
- ネットワーク図
- ER図
- UML図
- マインドマップ
- その他のビジネス図表

## API仕様

### 図表生成API

**エンドポイント**: `POST /api/generate-diagram`

**リクエスト**:
```json
{
  "prompt": "作成したい図表の日本語説明"
}
```

**成功レスポンス**:
```json
{
  "status": "success",
  "imageUrl": "生成されたPNG画像のURL",
  "downloadUrl": "生成された.drawioファイルのダウンロードURL",
  "message": "図表が正常に生成されました"
}
```

**エラーレスポンス**:
```json
{
  "status": "error",
  "message": "エラーの詳細説明",
  "code": "ERROR_CODE"
}
```

## トラブルシューティング

### よくある問題

1. **Draw.io CLIが見つからない**
   ```bash
   npm install -g @drawio/drawio-desktop-cli
   ```

2. **ANTHROPIC_API_KEYが設定されていない**
   - `packages/backend/.env`ファイルでAPI キーを設定してください

3. **ポートが使用中**
   - デフォルトポート（3000, 3001）が使用中の場合は環境変数で変更可能

4. **Docker関連の問題**
   - Docker Desktopが起動していることを確認
   - `docker-compose down`で既存コンテナを停止

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 貢献

プルリクエストやイシューの報告を歓迎します。開発に参加する前に、以下を実行してください：

```bash
npm run validate  # 型チェック、リント、テストの実行
```

## サポート

技術的な質問やバグレポートは、GitHubのIssuesページでお願いします。