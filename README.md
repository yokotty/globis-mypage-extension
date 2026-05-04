# GLOBIS マイページ拡張

GLOBIS VC マイページ向けの補助機能を1つに統合した Chrome 拡張です。  
ポップアップから機能ごとに ON/OFF を切り替えられます。

## Features

- 未いいね投稿を自動展開
- いいねの直後に投稿を閉じる
- ディスカッション画面のヘッダー/タブ/ツールバー余白をコンパクト化
- 本文先頭が重複するメンション/リアクション通知を非表示
- メンション通知本文を通知一覧で全文表示
- 最近の投稿をホーム画面内で展開
- プロフィール画面のメールアドレスをコピー
- 授業、イベント、勉強会、懇親会、投稿イベントを Google カレンダーに登録

## MVP の反映タイミング

設定は `chrome.storage.sync` に保存します。  
設定変更は現在開いているページへ即時反映せず、次回ページリロード時に反映されます。

## 対象ページ

- `https://vc.globis.ac.jp/my/*`

## インストール方法

1. `chrome://extensions` を開く
2. Developer Mode を ON
3. "Load unpacked" をクリック
4. このリポジトリのルートフォルダを選択

## 使い方

1. Chrome ツールバーの拡張アイコンを開く
2. 使いたい機能だけ ON にする
3. 対象ページをリロードする

拡張機能をピン留めしていない場合は、`chrome://extensions` の詳細画面から「拡張機能のオプション」を開いて設定できます。

Google カレンダー連携は初回登録時に Google アカウントの認可が必要です。  
同じ予定は `globisKey` で重複チェックし、既存予定がある場合は作成をスキップします。

## 開発

```sh
npm test
```

## プライバシーポリシー・利用規約

- [プライバシーポリシー](https://yokotty.dev/globis-mypage-extension/privacy.html)
- [利用規約](https://yokotty.dev/globis-mypage-extension/terms.html)
