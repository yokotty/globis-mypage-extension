# Privacy Policy

GLOBIS マイページ拡張は、Google カレンダー連携を使う場合のみ Google Calendar API にアクセスします。

## 保存する情報

拡張機能の ON/OFF 設定を `chrome.storage.sync` に保存します。

## 取得・変更する情報

content script は対象ページ上の DOM を読み取り、表示補助のためにページ内の要素やスタイルを変更します。

Google カレンダー連携が ON の場合、対象ページ上の予定情報を読み取り、ユーザー操作に応じて Google カレンダーへ予定を登録します。重複確認のため、予定の識別子を Google Calendar API に問い合わせます。

## 第三者提供

取得した情報を第三者へ提供しません。
