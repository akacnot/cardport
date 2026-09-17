# CARD PORT

個人用カードショップ。公開先: https://akacnot.github.io/cardport/

画面はGitHub Pages、商品・注文の保存とログインはFirebase Spark (card-port) を使用します。決済・配送機能はなく、支払い方法の登録は不要です。

- ログインなしで商品を閲覧
- 管理者が同じ画面で商品を追加・編集
- 注文をFirestoreへ保存しシリアルナンバーを表示
- 本人の履歴と管理者の注文一覧
- 在庫は管理者が手動で更新

使い方: [説明書](https://akacnot.github.io/cardport/guide.html)

管理者はFirebase Authenticationに登録したメールアドレスとパスワードを使用します。旧デモのadminパスワードは現在のサイトでは使いません。秘密鍵や管理者パスワードをリポジトリに置かないでください。

ルートのindex.htmlが現在のサイトです。dist/、admin.js、products.jsは以前のデモで、現在の画面からは使用していません。
