"use strict";
(() => {
  // src/domain/phases.ts
  var PHASES = {
    P0: {
      id: "P0",
      label: "\u53D7\u4ED8\u7A81\u7834",
      goal: "30\u79D2\u4EE5\u5185\u306B\u4EE3\u8868\u3078\u53D6\u6B21\u3044\u3067\u3082\u3089\u3046",
      mustSay: [
        "\u304A\u5FD9\u3057\u3044\u3068\u3053\u308D\u6050\u308C\u5165\u308A\u307E\u3059\u3002\u4E00\u822C\u793E\u56E3\u6CD5\u4EBA\u4F01\u696D\u578B\u78BA\u5B9A\u62E0\u51FA\u5E74\u91D1\u76F8\u8AC7\u30BB\u30F3\u30BF\u30FC\u3068\u7533\u3057\u307E\u3059\u3002\u9000\u8077\u91D1\u6E96\u5099\u306B\u95A2\u3059\u308B\u4EF6\u3067\u3001\u4EE3\u8868\u306E\u4E2D\u6751\u69D8\u306B\u304A\u7E4B\u304E\u3044\u305F\u3060\u3051\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F"
      ],
      conditional: [
        {
          when: "\u7528\u4EF6\u3092\u554F\u308F\u308C\u305F\u3089",
          say: "\u4EE3\u8868\u306E\u4E2D\u6751\u69D8\u3054\u81EA\u8EAB\u306E\u9000\u8077\u91D1\u306E\u3054\u6E96\u5099\u306B\u95A2\u3059\u308B\u4EF6\u3067\u3059\u3002\u521D\u3081\u306B1\u70B9\u3060\u3051\u78BA\u8A8D\u306A\u306E\u3067\u3059\u304C\u3001\u5FA1\u793E\u3067\u306F\u5F79\u54E1\u69D8\u306E\u9000\u8077\u91D1\u306E\u3054\u6E96\u5099\u3084\u3001\u793E\u54E1\u69D8\u5411\u3051\u306E\u7A4D\u7ACB\u5236\u5EA6\u306F\u4F55\u304B\u3055\u308C\u3066\u3044\u307E\u3059\u304B\uFF1F"
        },
        {
          when: "\u300C\u55B6\u696D\u96FB\u8A71\u306F\u304A\u65AD\u308A\u3068\u8A00\u308F\u308C\u3066\u304A\u308A\u307E\u3059\u300D\u3068\u8A00\u308F\u308C\u305F\u3089",
          say: "\uFF08P0X \u3078\u9077\u79FB\u3057\u3066\u75D5\u8DE1\u3092\u6B8B\u3057\u3066\u7D42\u8A71\uFF09"
        }
      ],
      principles: [
        "\u7528\u4EF6\u3092\u5148\u306B\u30FB\u77ED\u304F\u8A00\u3046\u3002\u5B9F\u30C7\u30FC\u30BF\u3067\u901A\u3063\u305F\u53D7\u4ED8\u306F\u4F8B\u5916\u306A\u304F\u3053\u306E\u578B\u3002",
        "\u53D7\u4ED8\u306B\u3082\u5DFB\u304D\u8FBC\u307F\u8CEA\u554F\u3092\u6295\u3052\u308B\u3002\u53D7\u4ED8\u3092\u300E\u53D6\u6B21\u5224\u65AD\u8005\u300F\u304B\u3089\u300E\u60C5\u5831\u63D0\u4F9B\u8005\u300F\u306B\u5909\u3048\u308B\u3068\u5207\u3089\u308C\u306B\u304F\u3044\u3002",
        "\u9577\u3044\u81EA\u5DF1\u7D39\u4ECB\u3084\u5236\u5EA6\u8AAC\u660E\u3092\u53D7\u4ED8\u6BB5\u968E\u3067\u59CB\u3081\u306A\u3044\u3002"
      ],
      transition: "\u53D6\u6B21\u304C\u767A\u751F\u3057\u305F\u3089 P1 \u3078\u3002\u5F37\u56FA\u306A\u55B6\u696D\u96FB\u8A71\u62D2\u5426\u306A\u3089 P0X \u3078\u3002R1/R2 \u306E\u5207\u308A\u8FD4\u3057\u3067\u4EBA\u6570\u3092\u805E\u3044\u305F\u5834\u5408\u306F P3 \u3078\u3002",
      // P3 直行は R1（制度なし）・R2（多忙）の切り返しで、受付段階からそのまま
      // ヒアリング（人数確認）に入った場合の経路。
      // P5 直行は、その人数までこの段階で答えてもらえた場合の経路
      // （フェーズが発話に追いつかないと、同じ質問をもう一度することになる）
      allowedNext: ["P0", "P0X", "P1", "P3", "P5"],
      targetElapsedSec: 40
    },
    P0X: {
      id: "P0X",
      label: "\u53D7\u4ED8\u64A4\u9000\uFF08\u75D5\u8DE1\u6B8B\u3057\uFF09",
      goal: "\u5373\u7D42\u8A71\u305B\u305A\u5FC5\u305A1\u6587\u6B8B\u3057\u3066\u64A4\u9000\u3059\u308B",
      mustSay: [
        "\u304B\u3057\u3053\u307E\u308A\u307E\u3057\u305F\u3002\u539A\u751F\u52B4\u50CD\u7701\u304C\u7BA1\u8F44\u3059\u308B\u5236\u5EA6\u306B\u3064\u3044\u3066\u3001\u79C1\u3069\u3082\u6C11\u9593\u306E\u4E8B\u696D\u8005\u304C\u3054\u6848\u5185\u3057\u3066\u3044\u308B\u3082\u306E\u3067\u3059\u306E\u3067\u3001\u3082\u3057\u793E\u5185\u3067\u304A\u8A71\u304C\u51FA\u307E\u3057\u305F\u969B\u306F\u3054\u4F1D\u8A00\u3060\u3051\u3044\u305F\u3060\u3051\u307E\u3059\u3068\u5E78\u3044\u3067\u3059\u3002\u5931\u793C\u3044\u305F\u3057\u307E\u3059\u3002"
      ],
      conditional: [],
      principles: [
        "\u5B9F\u30C7\u30FC\u30BF\u3067\u306F\u3053\u306E\u5C64\uFF08\u7D0430\u4EF6\uFF09\u306B\u5207\u308A\u8FD4\u3057\u304C\u307B\u307C\u30BC\u30ED\u3002\u5373\u7D42\u8A71\u305B\u305A\u5FC5\u305A1\u6587\u6B8B\u3059\u3053\u3068\u3092\u6A19\u6E96\u5316\u3059\u308B\u3002",
        "\u98DF\u3044\u4E0B\u304C\u3089\u306A\u3044\u30021\u6587\u6B8B\u3057\u3066\u7D42\u8A71\u3059\u308B\u3002"
      ],
      transition: "\u767A\u8A71\u5F8C END\u3002",
      allowedNext: ["END"],
      targetElapsedSec: 50
    },
    P1: {
      id: "P1",
      label: "\u4EE3\u8868\u63A5\u7D9A\u30FB\u5DFB\u304D\u8FBC\u307F\u8CEA\u554F",
      goal: "\u76F8\u624B\u306B\u73FE\u72B6\u3092\u558B\u3089\u305B\u308B",
      mustSay: [
        "\u304A\u5FD9\u3057\u3044\u3068\u3053\u308D\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\u3002\u4E00\u822C\u793E\u56E3\u6CD5\u4EBA\u4F01\u696D\u578B\u78BA\u5B9A\u62E0\u51FA\u5E74\u91D1\u76F8\u8AC7\u30BB\u30F3\u30BF\u30FC\u3068\u7533\u3057\u307E\u3059\u3002\u7A81\u7136\u306E\u304A\u96FB\u8A71\u5931\u793C\u3044\u305F\u3057\u307E\u3059\u3002",
        "\u539A\u751F\u52B4\u50CD\u7701\u304C\u7BA1\u8F44\u3059\u308B\u9000\u8077\u91D1\u5236\u5EA6\u3001\u4F01\u696D\u578B\u78BA\u5B9A\u62E0\u51FA\u5E74\u91D1\u306B\u3064\u3044\u3066\u306E\u3054\u6848\u5185\u3067\u3059\u3002\u5236\u5EA6\u304C\u539A\u52B4\u7701\u306E\u7BA1\u8F44\u3067\u3001\u79C1\u3069\u3082\u306F\u305D\u306E\u5C0E\u5165\u3092\u652F\u63F4\u3057\u3066\u3044\u308B\u6C11\u9593\u306E\u4E8B\u696D\u8005\u306B\u306A\u308A\u307E\u3059\u3002",
        "\u521D\u3081\u306B1\u70B9\u3060\u3051\u78BA\u8A8D\u306A\u306E\u3067\u3059\u304C\u3001\u5FA1\u793E\u3067\u306F\u5F79\u54E1\u69D8\u306E\u9000\u8077\u91D1\u306E\u3054\u6E96\u5099\u3084\u3001\u793E\u54E1\u69D8\u5411\u3051\u306E\u7A4D\u7ACB\u5236\u5EA6\u306F\u4F55\u304B\u3055\u308C\u3066\u3044\u307E\u3059\u304B\uFF1F"
      ],
      conditional: [],
      principles: [
        "\u3010\u7ACB\u5834\u306E\u5207\u308A\u5206\u3051\u306F\u5FC5\u9808\u3011\u7BA1\u8F44\uFF08\u539A\u52B4\u7701\uFF09\u3068\u81EA\u793E\u306E\u7ACB\u5834\uFF08\u6C11\u9593\u306E\u5C0E\u5165\u652F\u63F4\u4E8B\u696D\u8005\uFF09\u3092\u5FC5\u305A\u540C\u3058\u4E00\u606F\u3067\u8A00\u3044\u5207\u308B\u3002",
        "NG\u30C7\u30FC\u30BF\u3067\u306F\u300E\u539A\u52B4\u7701\u7BA1\u8F44\u300F\u3060\u3051\u3092\u540D\u4E57\u3063\u305F\u7D50\u679C\u3001\u516C\u7684\u6A5F\u95A2\u3068\u8AA4\u8A8D\u3055\u308C\u3066\u6700\u5F8C\u307E\u3067\u565B\u307F\u5408\u308F\u305A\u7D42\u8A71\u3057\u305F\u4F8B\u304C\u3042\u308B\u3002",
        "\u3053\u3053\u3067\u306F\u5236\u5EA6\u306E\u30E1\u30EA\u30C3\u30C8\u3092\u307E\u3060\u8AAC\u660E\u3057\u306A\u3044\u3002\u8CEA\u554F\u3067\u7D42\u3048\u308B\u3002"
      ],
      transition: "\u76F8\u624B\u304B\u3089\u4F55\u3089\u304B\u306E\u56DE\u7B54\u304C\u3042\u308C\u3070 P2 \u3078\u3002\u300C\u5236\u5EA6\u304C\u306A\u3044\u300D\u3068\u8A00\u308F\u308C\u305F\u5834\u5408\u306F R1 \u306B\u3088\u308A P3 \u3078\u76F4\u884C\u3059\u308B\u3002",
      // P3 直行は R1（退職金制度なし＝最も見込みが高いホットサイン）専用の経路。
      // P7 直行は「ホームページを見て」等で説明を打ち切られ、日程打診に切り替える経路
      allowedNext: ["P1", "P2", "P3", "P7", "P0X"],
      targetElapsedSec: 90
    },
    P2: {
      id: "P2",
      label: "\u65AD\u308A\u53D7\u3051\u6B62\u3081 \u2192 \u5145\u8DB3\u5EA6\u8CEA\u554F\uFF08\u2605\u6700\u91CD\u8981\uFF09",
      goal: "\u300C\u5236\u5EA6\u304C\u3042\u308B\u304B\u300D\u3067\u306F\u306A\u304F\u300C\u8DB3\u308A\u3066\u3044\u308B\u304B\u300D\u3092\u805E\u3044\u3066\u4F1A\u8A71\u3092\u7D99\u7D9A\u3055\u305B\u308B",
      mustSay: [
        "\uFF08\u53D7\u3051\u6B62\u3081\uFF09\u4FDD\u967A\u3067\u3054\u6E96\u5099\u3055\u308C\u3066\u3044\u308B\u3093\u3067\u3059\u306D\u3001\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\u3002",
        "\uFF08\u5145\u8DB3\u5EA6\u8CEA\u554F\uFF09\u3061\u306A\u307F\u306B\u305D\u3061\u3089\u306F\u3001\u4E2D\u6751\u69D8\u3054\u81EA\u8EAB\u306E\u9000\u8077\u91D1\u306E\u3054\u6E96\u5099\u3068\u3057\u3066\u3082\u5341\u5206\u306B\u6D3B\u7528\u3067\u304D\u3066\u3044\u3089\u3063\u3057\u3083\u3044\u307E\u3059\u304B\uFF1F"
      ],
      conditional: [
        {
          when: "\u300C\u5236\u5EA6\u306A\u3044\u3093\u3067\u3059\u300D\u3068\u8FD4\u3063\u3066\u304D\u305F\u5834\u5408",
          say: "\u65AD\u308A\u3067\u306F\u306A\u304F\u30DB\u30C3\u30C8\u30B5\u30A4\u30F3\u3068\u3057\u3066\u6271\u3046\uFF08\u30AC\u30FC\u30C9\u30EC\u30FC\u30EB R1 \u3092\u9069\u7528\u3057\u3001P3 \u3078\u9032\u3080\uFF09"
        }
      ],
      principles: [
        "\u53D7\u3051\u6B62\u3081\u3092\u5FC5\u305A\u5148\u306B\u7F6E\u304F\u3002\u5426\u5B9A\u30FB\u53CD\u8AD6\u304B\u3089\u5165\u3089\u306A\u3044\u3002",
        "\u5B9F\u30C7\u30FC\u30BF\u3067\u300C\u5C0E\u5165\u6E08\u307F\u300D\u7D0440\u4EF6\u306E\u3046\u3061\u3001\u4F1A\u8A71\u304C\u7D99\u7D9A\u3057\u305F\u306E\u306F\u3053\u306E\u5145\u8DB3\u5EA6\u8CEA\u554F\u306E\u578B\u306E\u307F\u3002",
        "\u3053\u3053\u3067\u307E\u3060\u5546\u54C1\u8AAC\u660E\u3092\u3057\u306A\u3044\u3002\u76F8\u624B\u304C\u4E0D\u8DB3\u30FB\u4E0D\u660E\u3092\u53E3\u306B\u3059\u308B\u307E\u3067\u5F85\u3064\u3002"
      ],
      transition: "\u76F8\u624B\u304C\u73FE\u72B6\u306E\u4E0D\u8DB3\u30FB\u4E0D\u660E\u3092\u53E3\u306B\u3057\u305F\u3089 P3 \u3078\u3002",
      // P7 直行は説明を打ち切られて日程打診に切り替える経路
      allowedNext: ["P2", "P3", "P7", "P0X"],
      targetElapsedSec: 120
    },
    P3: {
      id: "P3",
      label: "\u5DEE\u5225\u5316",
      goal: "\u300C\u4ECA\u3084\u3063\u3066\u3044\u308B\u3082\u306E\u3068\u306F\u5225\u67A0\u306E\u8A71\u300D\u3060\u3068\u7406\u89E3\u3055\u305B\u308B",
      mustSay: [
        "\u5B9F\u306F\u4FDD\u967A\u3068\u4F01\u696D\u5E74\u91D1\u5236\u5EA6\u306F\u5225\u306E\u3082\u306E\u3067\u3001\u3053\u3061\u3089\u306F\u4EE3\u8868\u3084\u5F79\u54E1\u306E\u65B9\u3054\u81EA\u8EAB\u304C\u3001\u5168\u984D\u4F1A\u793E\u306E\u7D4C\u8CBB\uFF08\u640D\u91D1\uFF09\u3067\u5C06\u6765\u306E\u8CC7\u7523\u5F62\u6210\u304C\u3067\u304D\u308B\u5236\u5EA6\u3067\u3059\u3002",
        "\u793E\u54E1\u3055\u3093\u306B\u3064\u3044\u3066\u306F\u984D\u9762\u304B\u3089\u7A4D\u307F\u7ACB\u3066\u308B\u5F62\u306B\u306A\u308A\u307E\u3059\u306E\u3067\u3001\u793E\u4F1A\u4FDD\u967A\u6599\u304C\u4E0B\u304C\u308B\u5834\u5408\u304C\u3042\u308A\u3001\u624B\u53D6\u308A\u3092\u5897\u3084\u3057\u306A\u304C\u3089\u5C06\u6765\u306E\u8CC7\u7523\u304C\u4F5C\u308C\u307E\u3059\u3002",
        "\u3064\u307E\u308A\u30B3\u30B9\u30C8\u3092\u5897\u3084\u3055\u305A\u306B\u5F85\u9047\u3092\u826F\u304F\u3067\u304D\u308B\u3001\u3068\u3044\u3046\u306E\u304C\u4E00\u756A\u306E\u30E1\u30EA\u30C3\u30C8\u3067\u3059\u3002"
      ],
      conditional: [
        {
          when: "\u300C\u4E2D\u9000\u5171\u306B\u5165\u3063\u3066\u3044\u308B\u300D",
          say: "\u4E2D\u9000\u5171\u306F\u5F93\u696D\u54E1\u69D8\u306E\u307F\u304C\u5BFE\u8C61\u3067\u3059\u306E\u3067\u3001\u4E2D\u6751\u69D8\u3054\u81EA\u8EAB\u306E\u9000\u8077\u91D1\u306F\u5225\u67A0\u306B\u306A\u308A\u307E\u3059"
        },
        {
          when: "\u300CiDeCo / \u5C0F\u898F\u6A21\u4F01\u696D\u5171\u6E08\u3092\u3084\u3063\u3066\u3044\u308B\u300D",
          say: "\u4F75\u7528\u3044\u305F\u3060\u3051\u307E\u3059\u3002iDeCo \u306F\u500B\u4EBA\u306E\u304A\u8CA1\u5E03\u304B\u3089\u3001\u4F01\u696D\u578BDC\u306F\u4F1A\u793E\u306E\u7D4C\u8CBB\u304B\u3089\u3001\u3068\u3044\u3046\u9055\u3044\u3067\u3059"
        }
      ],
      principles: [
        "\u3010\u7981\u6B62\u30EF\u30FC\u30C9\u3011\u300C\u793E\u4F1A\u4FDD\u967A\u6599\u306E\u524A\u6E1B\u306B\u306A\u308A\u307E\u3059\u300D\u306F\u65AD\u5B9A\u8868\u73FE\u3002\u5FC5\u305A\u300C\u4E0B\u304C\u308B\u5834\u5408\u304C\u3042\u308A\u307E\u3059\u300D\u3068\u8A00\u3046\u3002",
        "3\u70B9\uFF08\u640D\u91D1\u30FB\u793E\u4FDD\u30FB\u30B3\u30B9\u30C8\u5897\u306A\u3057\u306E\u5F85\u9047\u6539\u5584\uFF09\u3092\u77ED\u304F\u8A00\u3044\u5207\u308B\u3002\u9577\u3044\u8AAC\u660E\u306B\u3057\u306A\u3044\u3002"
      ],
      transition: "\u7406\u89E3\u306E\u53CD\u5FDC\u304C\u3042\u308C\u3070 P4 \u3078\u3002\u6CD5\u6539\u6B63\u30D5\u30C3\u30AF\u3092\u5192\u982D\u3067\u4F7F\u3044\u5207\u3063\u3066\u3044\u308B\u5834\u5408\u306F P5 \u3078\u76F4\u884C\u3059\u308B\u3002",
      // P5 直行は、収録台本のように法改正フック(P4 相当)を冒頭の概要で言い切った場合の経路
      allowedNext: ["P3", "P4", "P5", "P6", "P7", "P0X"],
      targetElapsedSec: 160
    },
    // 法改正の数値（施行日・拠出限度額）は 2026-09-08 に一次情報で確認済み。
    // 企業型DC の月額拠出限度額が 2026年12月1日施行で 55,000円 → 62,000円 に引き上げ。
    // 変更する場合はここが唯一の記載箇所。
    P4: {
      id: "P4",
      label: "\u6CD5\u6539\u6B63\u30D5\u30C3\u30AF\uFF081\u56DE\u306E\u307F\uFF09",
      goal: "\u59CB\u3081\u308B\u30BF\u30A4\u30DF\u30F3\u30B0\u3067\u640D\u5F97\u304C\u5909\u308F\u308B\u3053\u3068\u3092\u4F1D\u3048\u3001\u691C\u8A0E\u306E\u7DCA\u6025\u6027\u3092\u4F5C\u308B",
      mustSay: [
        "\u3055\u3089\u306B\u30012026\u5E7412\u67081\u65E5\u306B\u65BD\u884C\u3055\u308C\u308B\u6CD5\u6539\u6B63\u3067\u3001\u7D4C\u8CBB\u3067\u7A4D\u307F\u7ACB\u3066\u3067\u304D\u308B\u4E0A\u9650\u304C\u670855,000\u5186\u304B\u308962,000\u5186\u306B\u5F15\u304D\u4E0A\u3052\u3089\u308C\u307E\u3059\u3002\u59CB\u3081\u308B\u30BF\u30A4\u30DF\u30F3\u30B0\u3067\u640D\u5F97\u304C\u5909\u308F\u308B\u3068\u3053\u308D\u306A\u306E\u3067\u3001\u4E8B\u524D\u306B\u78BA\u8A8D\u3060\u3051\u3055\u308C\u308B\u4F01\u696D\u69D8\u304C\u5897\u3048\u3066\u3044\u308B\u72B6\u6CC1\u3067\u3059\u3002"
      ],
      conditional: [],
      principles: [
        "\u6CD5\u6539\u6B63\u30D5\u30C3\u30AF\u306F\u4F1A\u8A71\u5168\u4F53\u30671\u56DE\u3060\u3051\u3002\u3059\u3067\u306B\u4F7F\u7528\u6E08\u307F\u306A\u3089\u7E70\u308A\u8FD4\u3055\u306A\u3044\u3002",
        "\u5192\u982D\u3067\u306F\u4F7F\u308F\u306A\u3044\u3002\u76F8\u624B\u304C\u73FE\u72B6\u3092\u8A71\u3057\u305F\u5F8C\u306B\u306E\u307F\u4F7F\u3046\uFF08\u305D\u3046\u3057\u306A\u3044\u3068\u55B6\u696D\u96FB\u8A71\u3068\u5224\u5B9A\u3055\u308C\u308B\uFF09\u3002",
        "\u65BD\u884C\u65E5\u306F2026\u5E7412\u67081\u65E5\u3001\u9650\u5EA6\u984D\u306F\u670855,000\u5186\u219262,000\u5186\u3002\u3053\u306E\u6570\u5024\u3092\u8A00\u3044\u63DB\u3048\u305F\u308A\u4E38\u3081\u305F\u308A\u3057\u306A\u3044\u3002"
      ],
      transition: "\u767A\u8A71\u5F8C P5 \u3078\u3002",
      allowedNext: ["P5", "P6", "P0X"],
      targetElapsedSec: 190
    },
    P5: {
      id: "P5",
      label: "\u4F4E\u30CF\u30FC\u30C9\u30EB\u6253\u8A3A",
      goal: "\u610F\u601D\u6C7A\u5B9A\u3067\u306F\u306A\u304F\u60C5\u5831\u53D6\u5F97\u3068\u3057\u3066\u30A2\u30DD\u3092\u63D0\u793A\u3059\u308B",
      mustSay: [
        "\u5B9F\u969B\u3069\u308C\u304F\u3089\u3044\u30E1\u30EA\u30C3\u30C8\u304C\u51FA\u308B\u304B\u306F\u4EBA\u6570\u3084\u7D66\u4E0E\u306B\u3088\u3063\u3066\u5909\u308F\u308A\u307E\u3059\u306E\u3067\u3001\u4ECA\u3059\u3050\u3054\u5C0E\u5165\u304F\u3060\u3055\u3044\u3068\u3044\u3046\u304A\u8A71\u3067\u306F\u5168\u304F\u3054\u3056\u3044\u307E\u305B\u3093\u3002",
        "\u60C5\u5831\u53CE\u96C6\u306E\u4E00\u74B0\u3068\u3057\u306630\u5206\u307B\u3069\u3001Zoom \u3067\u5FA1\u793E\u306E\u5834\u5408\u306E\u8CBB\u7528\u5BFE\u52B9\u679C\u3068\u30B7\u30DF\u30E5\u30EC\u30FC\u30B7\u30E7\u30F3\u3001\u4ECA\u56DE\u306E\u6CD5\u6539\u6B63\u306E\u5F71\u97FF\u3060\u3051\u7C21\u5358\u306B\u304A\u4F1D\u3048\u3067\u304D\u308C\u3070\u3068\u601D\u3046\u306E\u3067\u3059\u304C\u3001\u3054\u90FD\u5408\u3044\u304B\u304C\u3067\u3057\u3087\u3046\u304B\uFF1F"
      ],
      conditional: [],
      principles: [
        "\u300C\u4ECA\u3059\u3050\u3054\u5C0E\u5165\u304F\u3060\u3055\u3044\u3068\u3044\u3046\u304A\u8A71\u3067\u306F\u5168\u304F\u3054\u3056\u3044\u307E\u305B\u3093\u300D\u306F\u5B9F\u30C7\u30FC\u30BF3\u4EF6\u3067\u5171\u901A\u3057\u3066\u52B9\u3044\u3066\u3044\u308B\u3002\u5FC5\u305A\u5165\u308C\u308B\u3002",
        "\u6240\u898130\u5206\u30FBZoom \u3092\u660E\u793A\u3059\u308B\u3002"
      ],
      transition: "\u5373OK \u306A\u3089 P7 \u3078\u3002\u4FDD\u7559\u30FB\u591A\u5FD9\u30FB\u8981\u76F8\u8AC7\u306A\u3089 P6 \u3078\u3002",
      allowedNext: ["P5", "P6", "P7", "P0X"],
      targetElapsedSec: 220
    },
    P6: {
      id: "P6",
      label: "\u4EEE\u62BC\u3055\u3048\u30AF\u30ED\u30FC\u30BA\uFF08\u2605\u6C7A\u5B9A\u6253\uFF09",
      goal: "\u591A\u5FD9\u30FB\u4FDD\u7559\u3092\u3001\u5185\u5BB9\u3067\u306F\u306A\u304F\u6642\u9593\u306E\u7D04\u675F\u306B\u5207\u308A\u66FF\u3048\u3066\u7A81\u7834\u3059\u308B",
      mustSay: [
        "\uFF08\u53CD\u8AD6\u3092\u6BB5\u53D6\u308A\u306B\u5909\u63DB\uFF09\u4E00\u5EA6\u304A\u8A71\u3092\u805E\u3044\u3066\u3044\u305F\u3060\u3044\u3066\u3001\u305D\u306E\u5F8C\u306B\u793E\u5185\u3067\u6D3B\u7528\u4FA1\u5024\u304C\u3042\u308B\u304B\u3054\u76F8\u8AC7\u3044\u305F\u3060\u304F\u3001\u3068\u3044\u3046\u6BB5\u53D6\u308A\u304C\u4E00\u756A\u304B\u3068\u601D\u3044\u307E\u3059\u3002",
        "\uFF08\u4EEE\u62BC\u3055\u3048\uFF09\u4E00\u5FDC\u3001\u4EEE\u62BC\u3055\u3048\u3060\u3051\u3067\u3082\u3055\u305B\u3066\u3044\u305F\u3060\u304D\u307E\u3057\u3087\u3046\u304B\u3002",
        "\uFF08\u30EA\u30B9\u30AF\u89E3\u9664\uFF09\u3054\u90FD\u5408\u304C\u60AA\u304F\u306A\u308A\u307E\u3057\u305F\u3089\u524D\u65E5\u306E\u304A\u96FB\u8A71\u3067\u5909\u66F4\u3044\u305F\u3060\u3051\u307E\u3059\u306E\u3067\u3002"
      ],
      conditional: [],
      principles: [
        "\u3010\u6700\u91CD\u8981\u539F\u5247\u3011\u5FD9\u3057\u3044\u76F8\u624B\u306B\u5185\u5BB9\u3092\u88AB\u305B\u306A\u3044\u3002P6 \u3067\u306F\u65B0\u3057\u3044\u5236\u5EA6\u8AAC\u660E\u3092\u4E00\u5207\u8DB3\u3055\u306A\u3044\u3002",
        "\u5B9F\u30C7\u30FC\u30BF\u3067\u306F\u8AAC\u660E\u3092\u88AB\u305B\u305F\u67B6\u96FB\u306F10\u4EF6\u4EE5\u4E0A\u3059\u3079\u3066\u5207\u3089\u308C\u3001\u6642\u9593\u306E\u8A71\u306B\u5207\u308A\u66FF\u3048\u305F\u67B6\u96FB\u306E\u307F\u304C\u901A\u3063\u3066\u3044\u308B\u3002"
      ],
      transition: "\u4EEE\u62BC\u3055\u3048\u306E\u540C\u610F\u304C\u5F97\u3089\u308C\u305F\u3089 P7 \u3078\u3002",
      allowedNext: ["P6", "P7", "P0X"],
      targetElapsedSec: 260
    },
    P7: {
      id: "P7",
      label: "\u65E5\u7A0B2\u629E\u30AF\u30ED\u30FC\u30BA",
      goal: "\u958B\u3044\u305F\u8CEA\u554F\u3092\u4F7F\u308F\u305A\u306B\u65E5\u6642\u30921\u70B9\u306B\u78BA\u5B9A\u3055\u305B\u308B",
      mustSay: [
        "\u6765\u9031\u3067\u3057\u305F\u3089\u3001\u5348\u524D\u3068\u5348\u5F8C\u3069\u3061\u3089\u304C\u3088\u308D\u3057\u3044\u3067\u3059\u304B\uFF1F",
        "\u3067\u306F9\u670817\u65E5\uFF08\u6C34\uFF0914\u6642\u304B\u308930\u5206\u3067\u3044\u304B\u304C\u3067\u3057\u3087\u3046\u304B\uFF1F"
      ],
      conditional: [
        {
          when: "\u300CZoom \u3063\u3066\u4F55\uFF1F\u300D",
          say: "\u30B9\u30DE\u30FC\u30C8\u30D5\u30A9\u30F3\u3067\u3082\u53C2\u52A0\u3067\u304D\u307E\u3059\u3002\u30E1\u30FC\u30EB\u3067\u304A\u9001\u308A\u3059\u308B URL \u3092\u30BF\u30C3\u30D7\u3044\u305F\u3060\u304F\u3060\u3051\u3067\u3059"
        },
        { when: "\u300C\u305D\u3061\u3089\u9060\u3044\u3067\u3059\u3088\u300D", say: "\u30AA\u30F3\u30E9\u30A4\u30F3\u3067\u3059\u306E\u3067\u79FB\u52D5\u306F\u4E0D\u8981\u3067\u3059" }
      ],
      principles: [
        "\u300C\u3044\u3064\u304C\u3088\u308D\u3057\u3044\u3067\u3059\u304B\uFF1F\u300D\u306F\u7981\u6B62\u3002\u5FC5\u305A2\u629E \u2192 1\u70B9\u78BA\u5B9A\u306E\u9806\u3002",
        "\u65E5\u4ED8\u30FB\u6642\u523B\u306E\u4E21\u65B9\u3092\u8A00\u3044\u5207\u3063\u3066\u78BA\u8A8D\u3092\u53D6\u308B\u3002"
      ],
      transition: "\u65E5\u6642\u304C\u78BA\u5B9A\u3057\u305F\u3089 P8 \u3078\u3002",
      allowedNext: ["P7", "P8", "P0X"],
      targetElapsedSec: 280
    },
    P8: {
      id: "P8",
      label: "\u30D2\u30A2\u30EA\u30F3\u30B07\u9805\u76EE\uFF08\u2605\u672C\u547D\uFF09",
      goal: "H1\u301CH7 \u306E\u5168\u9805\u76EE\uFF0B\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\uFF0B\u524D\u65E5\u9023\u7D61\u5148\u3092\u53D6\u308A\u5207\u308B",
      mustSay: [
        "\uFF08\u8A31\u53EF\u53D6\u5F97\uFF09\u3067\u306F\u8CB4\u91CD\u306A\u304A\u6642\u9593\u3092\u3044\u305F\u3060\u304D\u307E\u3059\u306E\u3067\u3001\u5FA1\u793E\u69D8\u306B\u5408\u3063\u305F\u3054\u63D0\u6848\u3092\u3055\u305B\u3066\u3044\u305F\u3060\u304F\u305F\u3081\u306B\u4F55\u70B9\u304B\u3054\u8CEA\u554F\u3055\u305B\u3066\u304F\u3060\u3055\u3044\u3002\u4ECA\u304A\u6642\u9593\u3088\u308D\u3057\u3044\u3067\u3057\u3087\u3046\u304B\uFF1F",
        "\uFF08\u672A\u53D6\u5F97\u306E\u9805\u76EE\u30921\u3064\u305A\u3064\u8CEA\u554F\u3059\u308B\u3002\u8A73\u7D30\u306F\u4E0B\u8A18\u300C\u672A\u53D6\u5F97\u30B9\u30ED\u30C3\u30C8\u300D\u3092\u53C2\u7167\uFF09",
        "\uFF08\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u306F\u5FC5\u305A\u5FA9\u5531\u3057\u3066\u78BA\u8A8D\u3059\u308B\uFF09"
      ],
      conditional: [],
      principles: [
        "\u8A31\u53EF\u53D6\u5F97\u306E\u524D\u7F6E\u304D\u3092\u5FC5\u305A\u5148\u306B\u7F6E\u304F\u3002\u5B9F\u30C7\u30FC\u30BF\u3067\u306F\u3053\u306E\u524D\u7F6E\u304D\u3067\u30D2\u30A2\u30EA\u30F3\u30B0\u62D2\u5426\u304C\u30BC\u30ED\u306B\u306A\u3063\u3066\u3044\u308B\u3002",
        "1\u767A\u8A71\u3067\u8CEA\u554F\u306F\u6700\u59272\u3064\u307E\u3067\u3002\u77E2\u7D99\u304E\u65E9\u306B\u4E26\u3079\u306A\u3044\u3002",
        "H4\uFF08\u5F79\u54E1\u4EBA\u6570\u30FB\u5E74\u9F62\uFF09\u3068 H5\uFF08\u793E\u4F1A\u4FDD\u967A\u52A0\u5165\u4EBA\u6570\uFF09\u306F\u30B7\u30DF\u30E5\u30EC\u30FC\u30B7\u30E7\u30F3\u7CBE\u5EA6\u306B\u76F4\u7D50\u3059\u308B\u6700\u5927\u306E\u7A74\u3002\u672A\u53D6\u5F97\u306A\u3089\u7D76\u5BFE\u306B\u6B21\u3078\u9032\u307E\u306A\u3044\u3002",
        "\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u306F\u5FC5\u305A\u5FA9\u5531\u78BA\u8A8D\u3059\u308B\u3002"
      ],
      transition: "H1\u301CH7\u30FB\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\uFF08\u5FA9\u5531\u6E08\u307F\uFF09\u30FB\u524D\u65E5\u9023\u7D61\u5148\u30FB\u5E0C\u671B\u6642\u9593\u5E2F\u304C\u5168\u90E8\u63C3\u3063\u305F\u3089 P9 \u3078\u30021\u3064\u3067\u3082\u6B20\u3051\u3066\u3044\u305F\u3089 P8 \u306B\u7559\u307E\u308B\u3002",
      allowedNext: ["P8", "P9", "P0X"],
      targetElapsedSec: 390
    },
    P9: {
      id: "P9",
      label: "\u7DE0\u3081",
      goal: "\u7121\u65AD\u30AD\u30E3\u30F3\u30BB\u30EB\u3092\u9632\u304E\u3001\u30AB\u30EC\u30F3\u30C0\u30FC\u767B\u9332\u307E\u3067\u4F9D\u983C\u3057\u3066\u7D42\u8A71\u3059\u308B",
      mustSay: [
        "\uFF08\u62C5\u5F53\u8005\u4E88\u544A\uFF09\u5F53\u65E5\u306F\u5F0A\u793E\u30B0\u30EB\u30FC\u30D7\u306E\u793E\u4F1A\u4FDD\u967A\u52B4\u52D9\u58EB\u6CD5\u4EBA\u30D3\u30B8\u30CD\u30B9\u30D1\u30FC\u30C8\u30CA\u30FC\u306E\u6709\u8CC7\u683C\u306E\u30D7\u30E9\u30F3\u30CA\u30FC\u304B\u3089\u304A\u8A71\u3057\u3055\u305B\u3066\u3044\u305F\u3060\u304D\u307E\u3059\u3002\u4F1A\u793E\u6982\u8981\u3068 Zoom \u306E URL \u3092\u30E1\u30FC\u30EB\u3067\u304A\u9001\u308A\u3057\u307E\u3059\u3002",
        "\uFF08\u30AB\u30EC\u30F3\u30C0\u30FC\u767B\u9332\u4F9D\u983C\uFF09\u62C5\u5F53\u306E\u4E88\u5B9A\u306E\u517C\u306D\u5408\u3044\u3067\u3001\u3082\u3057\u65E5\u7A0B\u5909\u66F4\u306B\u306A\u308A\u307E\u3059\u3068\u6B21\u56DE\u306E\u3054\u6848\u5185\u304C\u304B\u306A\u308A\u5148\u306B\u306A\u308B\u53EF\u80FD\u6027\u304C\u3054\u3056\u3044\u307E\u3059\u3002\u304A\u624B\u6570\u3067\u3059\u304C9\u670817\u65E514\u6642\u3067\u3001\u4E00\u65E6\u30AB\u30EC\u30F3\u30C0\u30FC\u306B\u3054\u4E88\u5B9A\u3060\u3051\u5165\u308C\u3066\u304A\u3044\u3066\u3044\u305F\u3060\u3051\u307E\u3059\u3068\u52A9\u304B\u308A\u307E\u3059\u3002",
        "\uFF08\u524D\u65E5\u9023\u7D61\u306E\u4E88\u544A\uFF09\u524D\u65E5\u306B\u4E00\u5EA6\u78BA\u8A8D\u306E\u304A\u96FB\u8A71\u3092\u5DEE\u3057\u4E0A\u3052\u307E\u3059\u3002\u5F53\u65E5\u306F\u3069\u3046\u305E\u3088\u308D\u3057\u304F\u304A\u9858\u3044\u3044\u305F\u3057\u307E\u3059\u3002"
      ],
      conditional: [],
      principles: [
        "\u30AB\u30EC\u30F3\u30C0\u30FC\u767B\u9332\u4F9D\u983C\u306F\u5B9F\u30C7\u30FC\u30BF\u306753%\u3057\u304B\u5B9F\u65BD\u3055\u308C\u3066\u3044\u306A\u3044\u3002\u3053\u3053\u3092100%\u306B\u3059\u308B\u3053\u3068\u304C\u3053\u306E\u30C7\u30E2\u306E\u4E3B\u5F35\u306E1\u3064\u3002\u7701\u7565\u306F\u7D76\u5BFE\u306B\u4E0D\u53EF\u3002"
      ],
      transition: "3\u70B9\u3059\u3079\u3066\u767A\u8A71\u3057\u305F\u3089 END\u3002",
      allowedNext: ["P9", "END"],
      targetElapsedSec: 420
    },
    END: {
      id: "END",
      label: "\u7D42\u8A71",
      goal: "\u901A\u8A71\u7D42\u4E86",
      mustSay: [],
      conditional: [],
      principles: [],
      transition: "\u2014",
      allowedNext: ["END"],
      targetElapsedSec: 420
    }
  };
  var PHASE_ORDER = [
    "P0",
    "P1",
    "P2",
    "P3",
    "P4",
    "P5",
    "P6",
    "P7",
    "P8",
    "P9"
  ];

  // src/domain/hearing.ts
  var HEARING_SLOTS = [
    {
      id: "H1",
      label: "iDeCo\u30FB\u6295\u8CC7\u306E\u6709\u7121",
      question: "\u73FE\u5728 iDeCo \u3084\u305D\u306E\u4ED6\u306E\u6295\u8CC7\u306F\u3055\u308C\u3066\u3044\u307E\u3059\u304B\uFF1F\uFF08\u3055\u308C\u3066\u3044\u308B\u5834\u5408\u306F\u6708\u984D\u3082\uFF09",
      humanRate: 0.8,
      critical: false
    },
    {
      id: "H2",
      label: "\u65E2\u5B58\u306E\u9000\u8077\u91D1\u5236\u5EA6",
      question: "\u5FA1\u793E\u3067\u9000\u8077\u91D1\u5236\u5EA6\u306F\u4F55\u304B\u3054\u5C0E\u5165\u3055\u308C\u3066\u3044\u307E\u3059\u304B\uFF1F",
      humanRate: 0.87,
      critical: false
    },
    {
      id: "H3",
      label: "\u4EE3\u8868\u5E74\u9F62",
      question: "\u5DEE\u3057\u652F\u3048\u306A\u3051\u308C\u3070\u4E2D\u6751\u69D8\u306E\u3054\u5E74\u9F62\u3092\u4F3A\u3048\u307E\u3059\u304B\uFF1F",
      humanRate: 0.87,
      critical: false
    },
    {
      id: "H4",
      label: "\u5F79\u54E1\u4EBA\u6570\u30FB\u5E74\u9F62",
      question: "\u5F79\u54E1\u69D8\u306F\u4E2D\u6751\u69D8\u542B\u3081\u4F55\u540D\u3067\u3044\u3089\u3063\u3057\u3083\u3044\u307E\u3059\u304B\uFF1F\uFF08\u2192 \u5404\u5F79\u54E1\u306E\u3054\u5E74\u9F62\u3082\uFF09",
      humanRate: 0.73,
      critical: true
    },
    {
      id: "H5",
      label: "\u793E\u4F1A\u4FDD\u967A\u52A0\u5165\u4EBA\u6570",
      question: "\u793E\u4F1A\u4FDD\u967A\u306B\u3054\u52A0\u5165\u306E\u4EBA\u6570\u306F\u4F55\u540D\u304F\u3089\u3044\u3067\u3059\u304B\uFF1F",
      humanRate: 0.67,
      critical: true
    },
    {
      id: "H6",
      label: "\u6C7A\u88C1\u6A29",
      question: "\u3053\u3046\u3044\u3063\u305F\u5236\u5EA6\u3092\u3054\u5C0E\u5165\u3055\u308C\u308B\u969B\u306F\u4E2D\u6751\u69D8\u306E\u3054\u5224\u65AD\u3067\u6C7A\u3081\u3089\u308C\u307E\u3059\u304B\uFF1F",
      humanRate: 0.87,
      critical: false
    },
    {
      id: "H7",
      label: "\u6C7A\u7B97\u6708",
      question: "\u5FA1\u793E\u306E\u6C7A\u7B97\u6708\u306F\u3044\u3064\u306B\u306A\u308A\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F",
      humanRate: 0.8,
      critical: false
    }
  ];
  var HEARING_SLOT_MAP = new Map(HEARING_SLOTS.map((s) => [s.id, s]));

  // src/domain/guardrails.ts
  var GUARDRAILS = {
    R1: {
      id: "R1",
      trigger: "\u300C\u9000\u8077\u91D1\u5236\u5EA6\u306F\u306A\u3044\u300D\u300C\u3053\u308C\u304B\u3089\u300D",
      patterns: [
        // 「制度がない」の直接表現（表記ゆれ・丁寧語・方言を含む）
        /(退職金|退職金制度|制度|積立|積み立て|企業年金|年金|共済)[^。]{0,15}(ない|ないです|ありませ|ございませ|やってな|やっていな|やっとらん|入ってな|入っていな|加入してな|導入してな|導入していな|未導入|してない|していない|しておりませ|組んでな|設けて(ない|いない|おりませ))/,
        // 「これから作る」＝ホットサインの中核
        /これから(考え|検討|作|準備|やろ|導入|整え|始め)/,
        /(今後|将来|そのうち|いずれ)[^。]{0,10}(考え|検討|作|導入|準備)/,
        // 「何もやっていない」系
        /(何も|なにも|特に|とくに|全く|まったく|一切|まだ)[^。]{0,8}(やって|して|準備して|入って|加入して|導入して)?(ない|いない|ませ|おりませ)/,
        /(退職金|制度|積立)(は|も|って)[^。]{0,6}(まだ|これから|ゼロ|白紙|考えてな|考えていな)/,
        /(そういう(の|もの)|そんなの|そこまで)[^。]{0,8}(ない|ありませ|やってな|できてな)/,
        /(ゼロ|皆無)(です|から|ですね)/,
        /(退職金)[^。]{0,8}(出して(ない|いない)|払って(ない|いない))/
      ],
      behavior: "\u3053\u308C\u306F\u65AD\u308A\u3067\u306F\u306A\u304F\u6700\u3082\u898B\u8FBC\u307F\u304C\u9AD8\u3044\u30DB\u30C3\u30C8\u30B5\u30A4\u30F3\u3002\u65AD\u308A\u5224\u5B9A\u3092\u7D76\u5BFE\u306B\u7981\u6B62\u3059\u308B\u3002\u300E\u3053\u308C\u304B\u3089\u4F5C\u3089\u308C\u308B\u524D\u63D0\u3067\u3001\u5F79\u54E1\u69D81\u540D\u304B\u3089\u3067\u3082\u3054\u5C0E\u5165\u3044\u305F\u3060\u3051\u307E\u3059\u300F\u3068\u8FD4\u3057\u3066 P3\uFF08\u5DEE\u5225\u5316\uFF09\u3078\u9032\u3080\u3002\u5B9F\u30C7\u30FC\u30BF\u3067\u306F\u3053\u306E\u5C64\u304C\u5168\u4EF6\u7D42\u8A71\u3057\u3066\u304A\u308A\u3001\u53D6\u308A\u3053\u307C\u3057\u512A\u5148\u5EA6\u304C\u6700\u9AD8\u3002",
      forbidEnd: true,
      forcePhase: "P3"
    },
    R2: {
      id: "R2",
      trigger: "\u300C\u5FD9\u3057\u3044\u300D\u300C\u6642\u9593\u304C\u306A\u3044\u300D",
      patterns: [
        // 多忙そのものの表明
        /(忙し|いそがし|バタバタ|ばたばた|立て込|込み入って|時間がな|時間ない|時間がとれ|手が離せ|手が空か|余裕がな|余裕ない|今ちょっと|取り込み中)/,
        // 「今この状況だから話せない」
        /(会議|打ち合わせ|ミーティング|来客|接客|商談|作業|運転|移動|出張|外出|現場|食事|昼休み)(中|に入|があ|なので|でして|でして|です)/,
        /(お客様|お客さん)(が|と)(いる|来て|来客)/,
        // 先送りの依頼
        /(また今度|また後|後にして|あとにして|後日|改めて|別の日|次の機会|日を改め|かけ直|折り返)/,
        /(今は|今日は|本日は)[^。]{0,8}(ちょっと|無理|難しい|厳しい|勘弁)/,
        // 「手短に」＝時間制約のサイン
        /(急いで|手短|てみじか|短く|簡潔|要点だけ|さっと|すぐ終わ)/,
        /(あと|もう)\s*\d+\s*分/,
        /(すぐ|もうすぐ|これから)[^。]{0,6}(出|出かけ|終わ|始ま|行か)/
      ],
      behavior: "\u5236\u5EA6\u8AAC\u660E\u3092\u7D76\u5BFE\u306B\u88AB\u305B\u306A\u3044\u3002\u65B0\u3057\u3044\u60C5\u5831\u3092\u8DB3\u3055\u305A\u3001\u300E\u672C\u65E5\u4E2D\u3067\u304A\u6642\u9593\u3044\u305F\u3060\u3051\u308B\u9803\u306F\u3054\u3056\u3044\u307E\u305B\u3093\u304B\uFF1F\u300F\u307E\u305F\u306F P6 \u306E\u4EEE\u62BC\u3055\u3048\u30AF\u30ED\u30FC\u30BA\u306E\u307F\u3092\u884C\u3046\u3002\u5B9F\u30C7\u30FC\u30BF\u3067\u306F\u8AAC\u660E\u3092\u88AB\u305B\u305F\u67B6\u96FB\u306F10\u4EF6\u4EE5\u4E0A\u3059\u3079\u3066\u5207\u3089\u308C\u3066\u3044\u308B\u3002",
      forbidEnd: false,
      forcePhase: "P6"
    },
    R3: {
      id: "R3",
      trigger: "\u300C\u7A0E\u7406\u58EB\u30FB\u793E\u52B4\u58EB\u306B\u4EFB\u305B\u3066\u3044\u308B\u300D",
      patterns: [
        /(税理士|会計士|公認会計士|社労士|社会保険労務士|顧問|先生|会計事務所|税理士事務所|FP|ファイナンシャルプランナー|保険屋|保険会社|保険の担当|銀行|信金|証券|コンサル|専門家|プロ)[^。]{0,20}(任せ|まかせ|お願い|頼んで|相談|通じ|やってもら|見てもら|入って|担当|一任|決めて|聞いて|確認して)/,
        /(税理士|会計士|社労士|顧問|先生|担当の方)(に|と|が|から)[^。]{0,10}(聞|確認|話|相談|通し)/,
        /(そういう(の|こと)|そのへん|その辺|そこ)[^。]{0,10}(専門家|税理士|社労士|顧問|先生)/,
        /(顧問|担当)(の|が)(税理士|社労士|先生|方)/
      ],
      behavior: "\u5426\u5B9A\u3057\u306A\u3044\u3002\u300E\u5148\u751F\u306B\u3054\u76F8\u8AC7\u3044\u305F\u3060\u304F\u305F\u3081\u306E\u5224\u65AD\u6750\u6599\u3092\u304A\u6E21\u3057\u3059\u308B\u3068\u3053\u308D\u307E\u3067\u304C\u79C1\u3069\u3082\u306E\u62C5\u5F53\u3067\u3059\u300F\u3068\u8FD4\u3059\u3002\u300E\u7A0E\u7406\u58EB\u306F\u8A73\u3057\u304F\u306A\u3044\u300F\u7B49\u306E\u5C02\u9580\u5BB6\u3092\u4E0B\u3052\u308B\u8868\u73FE\u306F\u53CD\u767A\u3092\u62DB\u304F\u305F\u3081\u7D76\u5BFE\u306B\u7981\u6B62\u3002",
      forbidEnd: true
    },
    R4: {
      id: "R4",
      trigger: "\u300C\u8CC7\u6599\u3060\u3051\u9001\u3063\u3066\u300D",
      patterns: [
        /(資料|パンフ|パンフレット|案内|ご案内|書類|概要|カタログ|チラシ|データ|詳細)[^。]{0,12}(送っ|送付|郵送|投函|メール|ファックス|FAX|くださ|ちょうだい|頂戴|ほしい|欲しい|いただけ|もらえ|もらい)/,
        // 「まず見せて」だけでは何を見せるのか分からない（ホームページの案内かもしれない）ため、
        // 資料そのものを指す語を必須にする
        /(まず|とりあえず|一旦|いったん|一度|先に)[^。]{0,10}(資料|書面|紙|パンフ|カタログ|案内|概要)/,
        // 「ホームページを見て」は資料請求ではなく回避なので、ここでは拾わない
        // （dialogEngine の HP_REFERENCE で別扱いにする。
        //   混同するとメールアドレスの催促を始めてしまい会話が壊れる）
        /(メール|SMS|ショートメール|ファックス|FAX)[^。]{0,12}(で送|送っ|送付|ください|いただけ|もらえ)/,
        /(送っておいて|送るだけ|送ってもら|置いていって)/,
        /(見てから|読んでから|目を通してから)[^。]{0,10}(判断|検討|連絡|考え)/
      ],
      behavior: "\u9001\u4ED8\u3060\u3051\u3067\u7D42\u308F\u3089\u305B\u306A\u3044\u3002\u9001\u4ED8\u624B\u6BB5\u306E\u9078\u629E\u80A2\uFF08SMS / \u30E1\u30FC\u30EB / \u5C01\u66F8\uFF09\u3092\u63D0\u793A\u3057\u3001\u5FC5\u305A\u518D\u67B6\u96FB\u65E5\u306E\u78BA\u5B9A\u3092\u30BB\u30C3\u30C8\u3067\u53D6\u308B\u3002",
      forbidEnd: true
    },
    R5: {
      id: "R5",
      trigger: "\u516C\u7684\u6A5F\u95A2\u3068\u306E\u8AA4\u8A8D\uFF0F\u4ED6\u5236\u5EA6\uFF08iDeCo\u30FB\u500B\u4EBA\u5E74\u91D1\uFF09\u3068\u306E\u52D8\u9055\u3044",
      patterns: [
        /(お国|国が|国の|お役所|役所|市役所|区役所|町役場|公的|行政|官公庁|厚労省|厚生労働省)[^。]{0,10}(の方|の人|ですか|でしょ|から|さん|なんです|ですよね)/,
        /(年金機構|年金事務所|社会保険事務所|商工会|商工会議所|税務署|ハローワーク|労基|労働基準監督署)/,
        /(手数料|費用|お金|料金|コスト)[^。]{0,12}(かからん|かからない|かかりません|いらない|不要|無料|ただ|タダ)/,
        /(補助金|助成金|給付金|税金で)/,
        /(公務員|職員|担当官)(の方|さん|ですか)/,
        /(国|行政|役所)(が|の)(やって|やる|運営|主催)/,
        // 他制度との勘違い（個人の制度だと思われている）
        /(iDeCo|イデコ|個人年金|個人の年金|小規模企業共済|NISA|ニーサ|国民年金基金)[^。]{0,14}(のこと|の話|ですか|でしょ|ですよね|と同じ|じゃない|ではない|やつ|でしょう)/i,
        /(個人|自分)(で|の)[^。]{0,8}(年金|積立|運用|やるやつ|入るもの)/,
        /(それ|あれ)(は|って)[^。]{0,8}(個人|自分)(の|で)/
      ],
      behavior: "\u8AA4\u8A8D\u3092\u653E\u7F6E\u3057\u305F\u307E\u307E\u4F1A\u8A71\u3092\u9032\u3081\u306A\u3044\u3002\u516C\u7684\u6A5F\u95A2\u3068\u306E\u8AA4\u8A8D\u306A\u3089\u300E\u5236\u5EA6\u306F\u539A\u751F\u52B4\u50CD\u7701\u306E\u7BA1\u8F44\u3067\u3059\u304C\u3001\u79C1\u3069\u3082\u306F\u6C11\u9593\u306E\u5C0E\u5165\u652F\u63F4\u4E8B\u696D\u8005\u3067\u3059\u300F\u3068\u7ACB\u5834\u3092\u5207\u308A\u5206\u3051\u308B\u3002iDeCo\u30FB\u500B\u4EBA\u5E74\u91D1\u3068\u306E\u52D8\u9055\u3044\u306A\u3089\u300E\u500B\u4EBA\u306E\u5E74\u91D1\u3067\u306F\u306A\u304F\u3001\u4F1A\u793E\u5074\u306E\u8CA0\u62C5\u3082\u8EFD\u304F\u3067\u304D\u308B\u4F01\u696D\u578B\u306E\u5236\u5EA6\u300F\u3067\u3042\u308B\u3053\u3068\u3092\u4F1D\u3048\u308B\u3002",
      forbidEnd: true
    },
    R7: {
      id: "R7",
      trigger: "\u672C\u4EBA\u304C\u4E0D\u5728\uFF0F\u5FDC\u5BFE\u8005\u306B\u6C7A\u88C1\u6A29\u304C\u306A\u3044",
      patterns: [
        // 主語つき（「代表は外出しております」）
        /(代表|社長|専務|常務|会長|担当者|責任者|上の者|本人|主人)(は|が|も)?[^。]{0,12}(不在|おりませ|いませ|席を外|外出|留守|出張|休み|お休み|休んで|帰(り|って)|出て(ます|おり)|来て(ない|いない|おりませ))/,
        // 主語なし。受付は主語を省いて「今不在にしてます」と言うことのほうが多い
        /(不在|席を外|出かけ|出払|留守|帰社|帰宅|退社)/,
        /(外出|出張)(中|し(て|ており)|です|でして|でし)/,
        // 「ただいま席を外しております」「あいにく戻りが遅くなります」
        // ※「設けておりません」等を不在と誤判定しないよう、動詞に続く「おりません」は除く
        /(今|ただいま|只今|本日|当分|あいにく)[^。]{0,6}((?<!(して|やって|入って|設けて))おりませ|不在|席を外|外出|出かけ|出ており|留守|戻り)/,
        /(今|ただいま|只今)[はも]?い(ませ|ない)/,
        // 「本日は休みをいただいております」（昼休み＝多忙は R2 側で扱う）
        /(本日|今日|きょう|明日|あす)[^。]{0,4}(?<!昼)(休み|お休み|休業)/,
        /(休みを取|休んでおり|お休みをいただ)/,
        // 戻り時間の申し出（不在の言い換えとして頻出）
        /(戻り(は|ます|次第|ましたら|になり)|お戻り|戻って(き|まい|参))/,
        // 決裁権がない
        /(私|自分|わたくし|わたし)(では|には|は|じゃ)[^。]{0,12}(分から|わから|分かり(ませ|かね)|わかり(ませ|かね)|存じ|決められ|決裁|権限|判断でき|答えられ|お答えでき|なんとも)/,
        /(担当(では|じゃ)(ない|ありませ)|権限が(ない|ありませ)|決裁権(は|が)?(ない|ありませ))/,
        /(受付|事務|経理|パート|アルバイト|留守番)(の者|の人|です|でして)/,
        /(本社|本部|上の者|別の者|担当の者)(に|が|と)(確認|聞|回|代わ|繋)/,
        /(代表|社長)(に|へ)[^。]{0,8}(伝え|確認|聞いて)(ておき|ます|てみ)/
      ],
      behavior: "\u30D2\u30A2\u30EA\u30F3\u30B0\u3092\u7D9A\u3051\u306A\u3044\u3002\u4E0D\u5728\u306E\u5834\u5408\u306F\u623B\u308A\u6642\u9593\u3068\u6298\u308A\u8FD4\u3057\u5148\uFF08\u96FB\u8A71\u756A\u53F7\u30FB\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\uFF09\u306E\u78BA\u5B9A\u3060\u3051\u306B\u5207\u308A\u66FF\u3048\u3001\u6298\u308A\u8FD4\u3057\u3092\u7D04\u675F\u3057\u3066\u7D42\u8A71\u3059\u308B\u3002\u6C7A\u88C1\u6A29\u304C\u306A\u3044\u5834\u5408\u306F\u5224\u65AD\u3067\u304D\u308B\u65B9\u3078\u306E\u9023\u7D61\u624B\u6BB5\u306E\u78BA\u4FDD\u306B\u5207\u308A\u66FF\u3048\u308B\u3002",
      forbidEnd: false
    }
  };
  function detectGuardrails(customerUtterance) {
    const hits = [];
    for (const g of Object.values(GUARDRAILS)) {
      if (g.patterns.some((p) => p.test(customerUtterance))) hits.push(g.id);
    }
    return hits;
  }

  // src/domain/state.ts
  function createCallState() {
    return {
      phase: "P0",
      turns: [],
      hearing: { H1: null, H2: null, H3: null, H4: null, H5: null, H6: null, H7: null },
      email: null,
      emailConfirmed: false,
      callbackPhone: null,
      isCurrentNumber: false,
      callbackWindow: null,
      appointmentDate: null,
      appointmentTime: null,
      zoomAgreed: false,
      durationAgreed: false,
      calendarRequested: false,
      lawChangeHookUsed: false,
      firedGuardrails: [],
      blockedViolationCount: 0,
      isDecisionMaker: "unknown",
      ended: false
    };
  }
  function missingHearing(state2) {
    return HEARING_SLOTS.filter((s) => !state2.hearing[s.id]).map((s) => s.id);
  }
  function missingContact(state2) {
    const missing = [];
    if (!state2.email) missing.push("\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9");
    else if (!state2.emailConfirmed) missing.push("\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u306E\u5FA9\u5531\u78BA\u8A8D");
    if (!state2.callbackPhone) missing.push("\u524D\u65E5\u78BA\u8A8D\u306E\u9023\u7D61\u5148");
    if (!state2.callbackWindow) missing.push("\u524D\u65E5\u9023\u7D61\u306E\u5E0C\u671B\u6642\u9593\u5E2F");
    return missing;
  }
  function canLeaveHearing(state2) {
    return missingHearing(state2).length === 0 && missingContact(state2).length === 0;
  }
  function resolveTransition(state2, proposed, activeGuardrails, forbidEndGuardrails) {
    const current = PHASES[state2.phase];
    if (proposed !== state2.phase && !current.allowedNext.includes(proposed)) {
      return {
        phase: state2.phase,
        overrideReason: `${state2.phase} \u304B\u3089 ${proposed} \u3078\u306E\u9077\u79FB\u306F\u8A31\u53EF\u3055\u308C\u3066\u3044\u307E\u305B\u3093\uFF08\u8A31\u53EF: ${current.allowedNext.join(", ")}\uFF09\u3002\u30D5\u30A7\u30FC\u30BA\u3092\u7DAD\u6301\u3057\u307E\u3059\u3002`
      };
    }
    if (state2.phase === "P8" && proposed === "P9" && !canLeaveHearing(state2)) {
      const missing = [...missingHearing(state2), ...missingContact(state2)];
      return {
        phase: "P8",
        overrideReason: `\u30D2\u30A2\u30EA\u30F3\u30B0\u672A\u5145\u8DB3\u306E\u305F\u3081 P9 \u3078\u9032\u3081\u307E\u305B\u3093\uFF08\u672A\u53D6\u5F97: ${missing.join(" / ")}\uFF09\u3002`
      };
    }
    if (proposed === "END" && state2.phase !== "P9" && state2.phase !== "P0X") {
      const blocking = activeGuardrails.filter((g) => forbidEndGuardrails.includes(g));
      if (blocking.length > 0) {
        return {
          phase: state2.phase,
          overrideReason: `\u30AC\u30FC\u30C9\u30EC\u30FC\u30EB ${blocking.join(", ")} \u767A\u706B\u4E2D\u306E\u305F\u3081\u7D42\u8A71\u3067\u304D\u307E\u305B\u3093\u3002\u5207\u308A\u8FD4\u3057\u3092\u7D99\u7D9A\u3057\u307E\u3059\u3002`
        };
      }
    }
    return { phase: proposed };
  }
  function applyExtracted(state2, facts) {
    for (const id of ["H1", "H2", "H3", "H4", "H5", "H6", "H7"]) {
      const v = facts[id];
      if (v && v.trim()) state2.hearing[id] = v.trim();
    }
    if (facts.email?.trim()) state2.email = facts.email.trim();
    if (facts.email_confirmed) state2.emailConfirmed = true;
    if (facts.callback_phone?.trim()) state2.callbackPhone = facts.callback_phone.trim();
    if (facts.is_current_number) state2.isCurrentNumber = true;
    if (facts.callback_window?.trim()) state2.callbackWindow = facts.callback_window.trim();
    if (facts.appointment_date?.trim()) state2.appointmentDate = facts.appointment_date.trim();
    if (facts.appointment_time?.trim()) state2.appointmentTime = facts.appointment_time.trim();
    if (facts.zoom_agreed) state2.zoomAgreed = true;
    if (facts.duration_agreed) state2.durationAgreed = true;
    if (facts.calendar_requested) state2.calendarRequested = true;
    if (facts.law_change_hook_used) state2.lawChangeHookUsed = true;
  }

  // src/domain/dod.ts
  function evaluateDod(state2) {
    const filledHearing = HEARING_SLOTS.filter((s) => state2.hearing[s.id]);
    const hearingCoverage = filledHearing.length / HEARING_SLOTS.length;
    const items = [
      {
        key: "appointment",
        label: "\u5546\u8AC7\u65E5\u6642\u304C\u78BA\u5B9A\u3057\u3066\u3044\u308B\uFF08\u65E5\u30FB\u6642\u523B\u3068\u3082\uFF09",
        ok: Boolean(state2.appointmentDate && state2.appointmentTime),
        detail: state2.appointmentDate && state2.appointmentTime ? `${state2.appointmentDate} ${state2.appointmentTime}` : "\u672A\u78BA\u5B9A"
      },
      {
        key: "zoom",
        label: "Zoom \u5B9F\u65BD\u3068\u6240\u898130\u5206\u306B\u540C\u610F\u3092\u5F97\u3066\u3044\u308B",
        ok: state2.zoomAgreed && state2.durationAgreed,
        detail: `Zoom: ${state2.zoomAgreed ? "\u540C\u610F" : "\u672A"} / 30\u5206: ${state2.durationAgreed ? "\u540C\u610F" : "\u672A"}`
      },
      {
        key: "hearing",
        label: "H1\u301CH7 \u306E7\u9805\u76EE\u3059\u3079\u3066\u53D6\u5F97",
        ok: missingHearing(state2).length === 0,
        detail: missingHearing(state2).length === 0 ? "7/7 \u53D6\u5F97" : `\u672A\u53D6\u5F97: ${missingHearing(state2).map((id) => `${id}(${HEARING_SLOT_MAP.get(id)?.label})`).join(", ")}`
      },
      {
        key: "email",
        label: "\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u53D6\u5F97\uFF0B\u5FA9\u5531\u78BA\u8A8D\u6E08\u307F",
        ok: Boolean(state2.email) && state2.emailConfirmed,
        detail: state2.email ? `${state2.email}${state2.emailConfirmed ? "\uFF08\u5FA9\u5531\u78BA\u8A8D\u6E08\u307F\uFF09" : "\uFF08\u5FA9\u5531\u672A\u5B9F\u65BD\uFF09"}` : "\u672A\u53D6\u5F97"
      },
      {
        key: "callback",
        label: "\u524D\u65E5\u78BA\u8A8D\u306E\u9023\u7D61\u5148\u3068\u5E0C\u671B\u6642\u9593\u5E2F\u3092\u53D6\u5F97",
        ok: Boolean(state2.callbackPhone && state2.callbackWindow),
        detail: state2.callbackPhone && state2.callbackWindow ? `${state2.callbackPhone} / ${state2.callbackWindow}` : `\u672A\u53D6\u5F97: ${missingContact(state2).join(", ") || "-"}`
      },
      {
        key: "calendar",
        label: "\u30AB\u30EC\u30F3\u30C0\u30FC\u767B\u9332\u3092\u4F9D\u983C\u3057\u305F",
        ok: state2.calendarRequested,
        detail: state2.calendarRequested ? "\u4F9D\u983C\u6E08\u307F" : "\u672A\u5B9F\u65BD"
      },
      {
        key: "compliance",
        label: "\u7981\u6B62\u30EF\u30FC\u30C9\u306E\u767A\u8A71\u30BC\u30ED",
        // 出力前フィルタで止めているため、相手に届いた違反は常に 0 件。
        ok: true,
        detail: `\u76F8\u624B\u306B\u5C4A\u3044\u305F\u9055\u53CD 0 \u4EF6\uFF08\u51FA\u529B\u524D\u30D5\u30A3\u30EB\u30BF\u3067\u30D6\u30ED\u30C3\u30AF: ${state2.blockedViolationCount} \u4EF6\uFF09`
      }
    ];
    return {
      items,
      passed: items.every((i) => i.ok),
      hearingCoverage,
      humanBaseline: [
        { label: "\u793E\u4F1A\u4FDD\u967A\u52A0\u5165\u4EBA\u6570\uFF08H5\uFF09", human: 0.67, ai: state2.hearing.H5 ? 1 : 0 },
        { label: "\u5F79\u54E1\u4EBA\u6570\u30FB\u5E74\u9F62\uFF08H4\uFF09", human: 0.73, ai: state2.hearing.H4 ? 1 : 0 },
        { label: "\u30AB\u30EC\u30F3\u30C0\u30FC\u767B\u9332\u4F9D\u983C", human: 0.53, ai: state2.calendarRequested ? 1 : 0 }
      ]
    };
  }

  // src/demo/scenario.ts
  var DEMO_SCENARIO = {
    agentOrg: "\u4E00\u822C\u793E\u56E3\u6CD5\u4EBA\u4F01\u696D\u578B\u78BA\u5B9A\u62E0\u51FA\u5E74\u91D1\u76F8\u8AC7\u30BB\u30F3\u30BF\u30FC",
    partnerOrg: "\u793E\u4F1A\u4FDD\u967A\u52B4\u52D9\u58EB\u6CD5\u4EBA\u30D3\u30B8\u30CD\u30B9\u30D1\u30FC\u30C8\u30CA\u30FC",
    companyName: "\u682A\u5F0F\u4F1A\u793E\u30B5\u30F3\u30D7\u30EB\u5DE5\u696D",
    employeeCount: 12,
    officerCount: 2,
    contactName: "\u4E2D\u6751",
    contactTitle: "\u4EE3\u8868",
    proposedDate: "9\u670817\u65E5\uFF08\u6C34\uFF09",
    proposedTime: "14\u6642",
    meetingMinutes: 30,
    situation: "\u30CF\u30ED\u30FC\u30EF\u30FC\u30AF\u6C42\u4EBA\u30EA\u30B9\u30C8\u304B\u3089\u306E\u65B0\u898F\u67B6\u96FB\uFF08\u904E\u53BB\u306E\u63A5\u70B9\u306A\u3057\uFF09\u3002\u4EE3\u8868\u306F50\u4EE3\u3001\u9000\u8077\u91D1\u306F\u4FDD\u967A\u3067\u5BFE\u5FDC\u6E08\u307F\u3001\u4F01\u696D\u578BDC\u306F\u672A\u8A8D\u77E5\u3002"
  };

  // src/web/speech.ts
  var VOICE_HINTS = [
    [/natural/i, 100],
    // Microsoft Nanami/Keita Online (Natural) — 最も自然
    [/google/i, 80],
    // Chrome の Google 日本語
    [/(enhanced|premium|siri)/i, 60],
    // macOS の高品質版
    [/(nanami|keita|kyoko|otoya|o-ren|sayaka|ichiro|mizuki|takumi|ayumi|haruka)/i, 40]
  ];
  function scoreVoice(v) {
    let score = 0;
    for (const [re, pt] of VOICE_HINTS) if (re.test(v.name)) score += pt;
    if (!v.localService) score += 20;
    if (v.default) score += 5;
    return score;
  }
  function loadVoices() {
    const now = window.speechSynthesis.getVoices();
    if (now.length > 0) return Promise.resolve(now);
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1200);
      window.speechSynthesis.addEventListener(
        "voiceschanged",
        () => {
          window.clearTimeout(timer);
          resolve(window.speechSynthesis.getVoices());
        },
        { once: true }
      );
    });
  }
  async function japaneseVoices() {
    const all = await loadVoices();
    return all.filter((v) => v.lang.toLowerCase().startsWith("ja")).sort((a, b) => scoreVoice(b) - scoreVoice(a));
  }
  var WEEKDAY = /（([月火水木金土日])）/g;
  var EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  var PHONE = /(\d{2,4})-(\d{2,4})-(\d{3,4})/g;
  var DOMAIN_KANA = {
    co: "\u30B7\u30FC\u30AA\u30FC",
    jp: "\u30B8\u30A7\u30A4\u30D4\u30FC",
    com: "\u30B3\u30E0",
    ne: "\u30A8\u30CC\u30A4\u30FC",
    or: "\u30AA\u30FC\u30A2\u30FC\u30EB",
    ac: "\u30A8\u30FC\u30B7\u30FC",
    go: "\u30B8\u30FC\u30AA\u30FC",
    net: "\u30CD\u30C3\u30C8",
    org: "\u30AA\u30FC\u30B0"
  };
  var DISCOURSE = /(^|[。！？」])(実は|さらに|つまり|ちなみに|ですので|それでは)(?![、。])/g;
  function speechText(raw) {
    let t = raw;
    t = t.replace(WEEKDAY, "$1\u66DC\u65E5").replace(/([月火水木金土日]曜日)(?=\d)/g, "$1\u3001");
    t = t.replace(
      EMAIL,
      (m) => m.replace(/@/g, " \u30A2\u30C3\u30C8\u30DE\u30FC\u30AF ").replace(/\./g, " \u30C9\u30C3\u30C8 ").replace(/-/g, " \u30CF\u30A4\u30D5\u30F3 ").replace(/\b(co|jp|com|ne|or|ac|go|net|org)\b/gi, (w) => DOMAIN_KANA[w.toLowerCase()] ?? w)
    );
    t = t.replace(PHONE, "$1\u306E$2\u306E$3");
    t = t.replace(/[（(][^）)]*[）)]/g, "");
    t = t.replace(/iDeCo/gi, "\u30A4\u30C7\u30B3").replace(/Zoom/gi, "\u30BA\u30FC\u30E0").replace(/URL/g, "\u30E6\u30FC\u30A2\u30FC\u30EB\u30A8\u30EB").replace(/企業型DC/g, "\u4F01\u696D\u578B\u30C7\u30A3\u30FC\u30B7\u30FC").replace(/\bDC\b/g, "\u30C7\u30A3\u30FC\u30B7\u30FC").replace(/SMS/g, "\u30A8\u30B9\u30A8\u30E0\u30A8\u30B9");
    t = t.replace(/(\d),(\d{3})/g, "$1$2");
    t = t.replace(/55000円/g, "\u4E94\u4E07\u4E94\u5343\u5186").replace(/62000円/g, "\u516D\u4E07\u4E8C\u5343\u5186");
    t = t.replace(DISCOURSE, "$1$2\u3001");
    return t.replace(/[　\s]+/g, " ").replace(/(?<=[^\x00-\x7F])\s+(?=[^\x00-\x7F])/g, "").trim();
  }
  function splitForSpeech(text) {
    const parts = text.split(/(?<=[。！？])/).map((s) => s.trim()).filter(Boolean);
    const out = [];
    for (const p of parts) {
      const prev = out.at(-1);
      if (prev && prev.length < 8) out[out.length - 1] = `${prev}${p}`;
      else out.push(p);
    }
    return out.length > 0 ? out : [text];
  }
  function speakOne(text, opt) {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ja-JP";
      u.rate = opt.rate ?? 1;
      u.pitch = opt.pitch ?? 1;
      if (opt.voice) u.voice = opt.voice;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        resolve();
      };
      u.onend = finish;
      u.onerror = finish;
      const timer = window.setTimeout(finish, Math.max(3500, text.length * 260));
      window.speechSynthesis.speak(u);
    });
  }
  var wait = (ms) => new Promise((r) => window.setTimeout(r, ms));
  async function speakUtterance(raw, opt) {
    if (!("speechSynthesis" in window) || !raw.trim()) return;
    const sentences = splitForSpeech(speechText(raw));
    for (let i = 0; i < sentences.length; i++) {
      await speakOne(sentences[i], opt);
      if (i < sentences.length - 1) await wait(opt.gapMs ?? 220);
    }
  }
  var currentAudio = null;
  function stopAudio() {
    const a = currentAudio;
    currentAudio = null;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
  }
  function playAudioFile(url) {
    stopAudio();
    return new Promise((resolve) => {
      const audio = new Audio(url);
      currentAudio = audio;
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        if (currentAudio === audio) currentAudio = null;
        resolve(ok);
      };
      audio.onended = () => finish(true);
      audio.onerror = () => finish(false);
      audio.play().catch(() => finish(false));
    });
  }

  // src/web/mic.ts
  function ctor() {
    const w = window;
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
  }
  var micSupported = () => ctor() !== null;
  function micErrorMessage(code) {
    switch (code) {
      case "not-allowed":
      case "service-not-allowed":
        return "\u30DE\u30A4\u30AF\u306E\u4F7F\u7528\u304C\u8A31\u53EF\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002\u30D6\u30E9\u30A6\u30B6\u306E\u30A2\u30C9\u30EC\u30B9\u30D0\u30FC\u304B\u3089\u30DE\u30A4\u30AF\u3092\u8A31\u53EF\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
      case "no-speech":
        return "\u97F3\u58F0\u304C\u691C\u51FA\u3055\u308C\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002";
      case "audio-capture":
        return "\u30DE\u30A4\u30AF\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002\u5165\u529B\u30C7\u30D0\u30A4\u30B9\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
      case "network":
        return "\u97F3\u58F0\u8A8D\u8B58\u30B5\u30FC\u30D0\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
      case "aborted":
        return "\u97F3\u58F0\u5165\u529B\u3092\u4E2D\u6B62\u3057\u307E\u3057\u305F\u3002";
      default:
        return `\u97F3\u58F0\u8A8D\u8B58\u3067\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F\uFF08${code}\uFF09\u3002`;
    }
  }
  var MicInput = class {
    rec = null;
    finalText = "";
    get listening() {
      return this.rec !== null;
    }
    start(handlers) {
      const C = ctor();
      if (!C) {
        handlers.onError("\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306F\u97F3\u58F0\u8A8D\u8B58\u306B\u5BFE\u5FDC\u3057\u3066\u3044\u307E\u305B\u3093\uFF08Chrome / Edge / Safari \u3092\u304A\u4F7F\u3044\u304F\u3060\u3055\u3044\uFF09\u3002");
        return;
      }
      if (this.rec) return;
      const rec = new C();
      rec.lang = "ja-JP";
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      this.finalText = "";
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (!r) continue;
          const text = r[0]?.transcript ?? "";
          if (r.isFinal) this.finalText += text;
          else interim += text;
        }
        if (interim) handlers.onInterim?.(this.finalText + interim);
      };
      rec.onerror = (e) => {
        handlers.onError(micErrorMessage(e.error));
      };
      rec.onend = () => {
        this.rec = null;
        const text = this.finalText.trim();
        if (text) handlers.onFinal(text);
        handlers.onEnd?.();
      };
      this.rec = rec;
      rec.start();
    }
    /** 手動で確定させる（話し終わりの自動検出を待たない）。 */
    stop() {
      this.rec?.stop();
    }
    /** 破棄する（結果は使わない）。 */
    abort() {
      const r = this.rec;
      this.rec = null;
      r?.abort();
    }
  };

  // src/domain/forbidden.ts
  var FORBIDDEN_RULES = [
    {
      id: "F1",
      label: "\u793E\u4F1A\u4FDD\u967A\u6599\u306E\u65AD\u5B9A\uFF08\u4E0B\u304C\u308A\u307E\u3059\uFF0F\u524A\u6E1B\u306B\u306A\u308A\u307E\u3059\uFF09",
      pattern: /社会保険料[^。！？\n]{0,24}(削減|下がります|下がる(?!場合|ケース|可能性|ことが)|安くなります|減ります|減額|軽減されます)/,
      guard: /社会保険料[^。！？\n]{0,24}(場合があり|ことがあり|可能性があり)/,
      scope: "sentence",
      reason: "\u7D66\u4E0E\u984D\u30FB\u7B49\u7D1A\u306B\u3088\u308A\u4E0B\u304C\u3089\u306A\u3044\u5834\u5408\u304C\u3042\u308B\u305F\u3081\u65AD\u5B9A\u3067\u304D\u306A\u3044",
      alternative: "\u793E\u4F1A\u4FDD\u967A\u6599\u304C\u4E0B\u304C\u308B\u5834\u5408\u304C\u3042\u308A\u307E\u3059",
      fix: (t) => t.replace(/社会保険料の削減になります/g, "\u793E\u4F1A\u4FDD\u967A\u6599\u304C\u4E0B\u304C\u308B\u5834\u5408\u304C\u3042\u308A\u307E\u3059").replace(/社会保険料が削減されます/g, "\u793E\u4F1A\u4FDD\u967A\u6599\u304C\u4E0B\u304C\u308B\u5834\u5408\u304C\u3042\u308A\u307E\u3059").replace(/社会保険料が下がります/g, "\u793E\u4F1A\u4FDD\u967A\u6599\u304C\u4E0B\u304C\u308B\u5834\u5408\u304C\u3042\u308A\u307E\u3059").replace(/社会保険料が下がり、/g, "\u793E\u4F1A\u4FDD\u967A\u6599\u304C\u4E0B\u304C\u308B\u5834\u5408\u304C\u3042\u308A\u3001").replace(/社会保険料が安くなります/g, "\u793E\u4F1A\u4FDD\u967A\u6599\u304C\u4E0B\u304C\u308B\u5834\u5408\u304C\u3042\u308A\u307E\u3059").replace(/社会保険料が減ります/g, "\u793E\u4F1A\u4FDD\u967A\u6599\u304C\u4E0B\u304C\u308B\u5834\u5408\u304C\u3042\u308A\u307E\u3059")
    },
    {
      id: "F2",
      label: "\u5143\u672C\u4FDD\u8A3C\uFF0F\u5FC5\u305A\u5897\u3048\u308B",
      pattern: /(元本保証|元本は保証|必ず増え|絶対に増え|減りません|損はしません|リスクはありません)/,
      scope: "sentence",
      reason: "\u904B\u7528\u5546\u54C1\u306B\u3088\u3063\u3066\u306F\u5143\u672C\u3092\u4E0B\u56DE\u308B\u53EF\u80FD\u6027\u304C\u3042\u308B",
      alternative: "\u904B\u7528\u5546\u54C1\u306B\u3088\u3063\u3066\u7D50\u679C\u306F\u5909\u52D5\u3057\u307E\u3059"
    },
    {
      id: "F3",
      label: "\u5229\u56DE\u308A\u30FB\u53CE\u76CA\u306E\u65AD\u5B9A",
      pattern: /(絶対もうかり|絶対儲かり|必ずもうかり|必ず儲かり|必ず[0-9０-９]+[%％]|確実に[0-9０-９]+[%％])/,
      scope: "sentence",
      reason: "\u65AD\u5B9A\u4E0D\u53EF\uFF08\u4EE3\u66FF\u8868\u73FE\u306A\u3057\u30FB\u4F7F\u7528\u7981\u6B62\uFF09",
      alternative: null
    },
    {
      id: "F4",
      label: "\u63D0\u643A\u5148\u306E\u56FA\u6709\u540D",
      pattern: /(岡三証券|三井住友信託銀行|三井住友信託)/,
      scope: "utterance",
      reason: "\u63D0\u643A\u6761\u4EF6\u4E0A\u3001\u56FA\u6709\u540D\u3092\u51FA\u305B\u306A\u3044",
      alternative: "\uFF08\u56FA\u6709\u540D\u3092\u51FA\u3055\u305A\u300C\u63D0\u643A\u5148\u306E\u91D1\u878D\u6A5F\u95A2\u300D\u3068\u8868\u73FE\u3059\u308B\uFF09",
      fix: (t) => t.replace(/(岡三証券|三井住友信託銀行|三井住友信託)/g, "\u63D0\u643A\u5148\u306E\u91D1\u878D\u6A5F\u95A2")
    },
    {
      id: "F6",
      label: "\u62C5\u5F53\u8005\u306E\u500B\u4EBA\u540D\u3092\u540D\u4E57\u308B",
      // AI エージェントは団体名だけを名乗る。実在・架空を問わず人名を作らせない。
      pattern: /(センター|法人)の[^。、！？\s]{1,8}(と申します|でございます|が承ります)/,
      scope: "sentence",
      reason: "AI \u67B6\u96FB\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u306F\u500B\u4EBA\u540D\u3092\u540D\u4E57\u3089\u306A\u3044\uFF08\u5B9F\u5728\u3057\u306A\u3044\u62C5\u5F53\u8005\u540D\u306E\u751F\u6210\u3092\u9632\u3050\uFF09",
      alternative: "\u4E00\u822C\u793E\u56E3\u6CD5\u4EBA\u4F01\u696D\u578B\u78BA\u5B9A\u62E0\u51FA\u5E74\u91D1\u76F8\u8AC7\u30BB\u30F3\u30BF\u30FC\u3068\u7533\u3057\u307E\u3059",
      fix: (t) => t.replace(
        /(センター|法人)の[^。、！？\s]{1,8}(と申します|でございます|が承ります)/g,
        "$1$2"
      )
    },
    {
      id: "F5",
      label: "\u300C\u539A\u52B4\u7701\u7BA1\u8F44\u300D\u5358\u72EC\uFF08\u516C\u7684\u6A5F\u95A2\u3068\u306E\u8AA4\u8A8D\uFF09",
      pattern: /(厚生労働省|厚労省)/,
      guard: /(民間|一般社団法人|導入を支援|導入支援)/,
      scope: "utterance",
      reason: "\u516C\u7684\u6A5F\u95A2\u3068\u8AA4\u8A8D\u3055\u308C\u308B\u3068\u6700\u5F8C\u307E\u3067\u565B\u307F\u5408\u308F\u306A\u3044\uFF08NG\u30C7\u30FC\u30BF\u306B\u5B9F\u4F8B\u3042\u308A\uFF09",
      alternative: "\u5236\u5EA6\u306F\u539A\u751F\u52B4\u50CD\u7701\u306E\u7BA1\u8F44\u3067\u3001\u79C1\u3069\u3082\u306F\u6C11\u9593\u306E\u5C0E\u5165\u652F\u63F4\u4E8B\u696D\u8005\u3067\u3059"
    }
  ];
  function splitSentences(text) {
    return text.split(/(?<=[。！？\n])/).map((s) => s.trim()).filter((s) => s.length > 0);
  }
  function checkForbidden(utterance) {
    const violations = [];
    for (const rule of FORBIDDEN_RULES) {
      const targets = rule.scope === "utterance" ? [utterance] : splitSentences(utterance);
      for (const target of targets) {
        const m = rule.pattern.exec(target);
        if (!m) continue;
        if (rule.guard?.test(target)) continue;
        violations.push({
          ruleId: rule.id,
          label: rule.label,
          matched: m[0],
          reason: rule.reason,
          alternative: rule.alternative,
          fixable: Boolean(rule.fix)
        });
        break;
      }
    }
    return violations;
  }
  function autoFix(utterance) {
    let text = utterance;
    const applied = [];
    for (const rule of FORBIDDEN_RULES) {
      if (!rule.fix) continue;
      const before = text;
      text = rule.fix(text);
      if (text !== before) applied.push(rule.id);
    }
    return { text, applied };
  }

  // src/demo/dialogEngine.ts
  var AUDIO_BASE = "public/audio/";
  var VOICE_LINES = {
    greeting: {
      file: "p0_greeting.mp3",
      text: "\u304A\u4E16\u8A71\u306B\u306A\u3063\u3066\u304A\u308A\u307E\u3059\u3002\u79C1\u3001\u4F01\u696D\u578B\u78BA\u5B9A\u62E0\u51FA\u5E74\u91D1\u76F8\u8AC7\u30BB\u30F3\u30BF\u30FC\u3068\u7533\u3057\u307E\u3059\u30022026\u5E7412\u6708\u306E\u6CD5\u6539\u6B63\u306E\u4EF6\u3067\u3001\u3054\u62C5\u5F53\u8005\u69D8\u306B\u304A\u7E4B\u304E\u3044\u305F\u3060\u3051\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F"
    },
    overview: {
      file: "p1_overview.mp3",
      text: "\u3042\u3001\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\uFF01\u5B9F\u306F\u4ECA\u56DE\u306E\u6CD5\u6539\u6B63\u306B\u3088\u308A\u3001\u4F01\u696D\u578BDC\u306E\u5C0E\u5165\u8981\u4EF6\u304C\u5927\u5E45\u306B\u7DE9\u548C\u3055\u308C\u3001\u4E8B\u696D\u4E3B\u69D8\u306E\u7BC0\u7A0E\u52B9\u679C\u3084\u512A\u79C0\u306A\u4EBA\u6750\u78BA\u4FDD\u306B\u5411\u3051\u305F\u30E1\u30EA\u30C3\u30C8\u304C\u975E\u5E38\u306B\u5927\u304D\u304F\u306A\u3063\u3066\u304A\u308A\u307E\u3059\u3002\u5FA1\u793E\u3067\u306E\u3054\u6D3B\u7528\u72B6\u6CC1\u306B\u3064\u3044\u3066\u78BA\u8A8D\u3067\u304A\u96FB\u8A71\u3055\u305B\u3066\u3044\u305F\u3060\u304D\u307E\u3057\u305F\u3002"
    },
    hearingAgeCount: {
      file: "p2_p3_hearing.mp3",
      text: "\u3054\u56DE\u7B54\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\uFF01\u73FE\u5728\u5FA1\u793E\u3067\u5BFE\u8C61\u3068\u306A\u308B\u65B9\u306E\u4E3B\u306A\u5E74\u9F62\u5C64\u3068\u3001\u5F79\u54E1\u69D8\u30FB\u5F93\u696D\u54E1\u69D8\u3092\u5408\u308F\u305B\u305F\u5168\u4F53\u306E\u4EBA\u6570\u306F\u304A\u304A\u3088\u305D\u4F55\u540D\u69D8\u306B\u306A\u308A\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F"
    },
    hearingFiscalEmail: {
      file: "p4_p5_hearin.mp3",
      text: "\u3054\u6559\u793A\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\uFF01\u6700\u65B0\u306E\u30B7\u30DF\u30E5\u30EC\u30FC\u30B7\u30E7\u30F3\u8CC7\u6599\u3092\u304A\u9001\u308A\u3057\u305F\u3044\u306E\u3067\u3059\u304C\u3001\u5FA1\u793E\u306E\u6C7A\u7B97\u6708\u3068\u3001\u9001\u4ED8\u5148\u306E\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3092\u304A\u4F3A\u3044\u3067\u304D\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F"
    },
    schedule: {
      file: "p7_schedule.mp3",
      text: "\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\uFF01\u3054\u72B6\u6CC1\u306B\u5408\u308F\u305B\u305F\u6700\u9069\u306A\u6D3B\u7528\u6848\u306B\u3064\u3044\u3066\u3001\u5F0A\u793E\u5C02\u9580\u30B9\u30BF\u30C3\u30D5\u3088\u308A15\u5206\u307B\u3069\u30AA\u30F3\u30E9\u30A4\u30F3\u3067\u3054\u6848\u5185\u3067\u304D\u308C\u3070\u3068\u5B58\u3058\u307E\u3059\u3002\u4F8B\u3048\u3070\u3001\u6765\u9031\u306E\u6C34\u66DC\u65E514\u6642\u9803\u306E\u3054\u90FD\u5408\u306F\u3044\u304B\u304C\u3067\u3057\u3087\u3046\u304B\uFF1F"
    },
    reschedule: {
      file: "reschedule.mp3",
      text: "\u5931\u793C\u3044\u305F\u3057\u307E\u3057\u305F\uFF01\u305D\u308C\u3067\u306F\u3001\u5225\u306E\u65E5\u6642\u3068\u3057\u3066\u6728\u66DC\u65E5\u306E15\u6642\u9803\u306F\u3044\u304B\u304C\u3067\u3057\u3087\u3046\u304B\uFF1F"
    },
    contact: {
      file: "p8_recovery.mp3",
      text: "\u3054\u6559\u793A\u3044\u305F\u3060\u304D\u8AA0\u306B\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\uFF01\u78BA\u8A8D\u306E\u305F\u3081\u3001\u3054\u62C5\u5F53\u8005\u69D8\u306E\u76F4\u901A\u306E\u304A\u96FB\u8A71\u756A\u53F7\u3001\u307E\u305F\u306F\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3092\u304A\u4F3A\u3044\u3057\u3066\u3082\u3088\u308D\u3057\u3044\u3067\u3057\u3087\u3046\u304B\uFF1F"
    },
    closing: {
      file: "p9_closing.mp3",
      text: "\u304A\u6642\u9593\u3092\u3044\u305F\u3060\u304D\u8AA0\u306B\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\uFF01\u305D\u308C\u3067\u306F\u3054\u6307\u5B9A\u306E\u65E5\u6642\u306B\u3001\u304A\u4F3A\u3044\u3044\u305F\u3057\u307E\u3057\u305F\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3078\u30AA\u30F3\u30E9\u30A4\u30F3\u4F1A\u8B70\u306EURL\u3092\u304A\u9001\u308A\u3044\u305F\u3057\u307E\u3059\u3002\u5F53\u65E5\u306F\u3069\u3046\u305E\u3088\u308D\u3057\u304F\u304A\u9858\u3044\u3044\u305F\u3057\u307E\u3059\u3002\u5931\u793C\u3044\u305F\u3057\u307E\u3059\u3002"
    },
    reject: {
      file: "reject_closing.mp3",
      text: "\u627F\u77E5\u3044\u305F\u3057\u307E\u3057\u305F\u3002\u8CB4\u91CD\u306A\u304A\u6642\u9593\u3092\u3044\u305F\u3060\u304D\u8AA0\u306B\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3057\u305F\u3002\u305D\u308C\u3067\u306F\u5931\u793C\u3044\u305F\u3057\u307E\u3059\u3002"
    },
    r1NoSystem: {
      file: "r1_no_system.mp3",
      text: "\u3042\u3001\u5931\u793C\u3044\u305F\u3057\u307E\u3057\u305F\uFF01\u5B9F\u306F\u4ECA\u56DE\u306E\u6CD5\u6539\u6B63\u306F\u3001\u307E\u3060\u5C0E\u5165\u3055\u308C\u3066\u3044\u306A\u3044\u4F01\u696D\u69D8\u307B\u3069\u7BC0\u7A0E\u3084\u30B3\u30B9\u30C8\u524A\u6E1B\u306E\u30E1\u30EA\u30C3\u30C8\u304C\u5927\u304D\u3044\u5185\u5BB9\u3068\u306A\u3063\u3066\u304A\u308A\u307E\u3059\u3002\u5DEE\u3057\u652F\u3048\u306A\u3051\u308C\u3070\u3001\u5FA1\u793E\u306E\u73FE\u5728\u306E\u5F93\u696D\u54E1\u6570\u3060\u3051\u304A\u4F3A\u3044\u3067\u304D\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F"
    },
    r2Busy: {
      file: "r2_busy.mp3",
      text: "\u3042\u3001\u5927\u5909\u5931\u793C\u3044\u305F\u3057\u307E\u3057\u305F\uFF01\u304A\u5FD9\u3057\u3044\u6642\u9593\u5E2F\u306B\u304A\u96FB\u8A71\u3057\u3066\u3057\u307E\u3044\u307E\u3057\u305F\u3088\u306D\u3002\u672C\u5F53\u306B30\u79D2\u3060\u3051\u8981\u70B9\u3092\u304A\u4F1D\u3048\u3057\u3066\u3001\u3059\u3050\u306B\u304A\u96FB\u8A71\u5207\u3089\u305B\u3066\u3044\u305F\u3060\u304D\u307E\u3059\u306D\u3002\u5B9F\u306F\u4ECA\u56DE\u306E\u6CD5\u6539\u6B63\u3067\u4F01\u696D\u578BDC\u306E\u5C0E\u5165\u8981\u4EF6\u304C\u5927\u304D\u304F\u5909\u308F\u308A\u3001\u4F1A\u793E\u5074\u306E\u7BC0\u7A0E\u30E1\u30EA\u30C3\u30C8\u304C\u975E\u5E38\u306B\u5927\u304D\u304F\u306A\u3063\u305F\u305F\u3081\u78BA\u8A8D\u3067\u304A\u96FB\u8A71\u3044\u305F\u3057\u307E\u3057\u305F\u3002\u5DEE\u3057\u652F\u3048\u306A\u3051\u308C\u3070\u3001\u5FA1\u793E\u306E\u73FE\u5728\u306E\u5F93\u696D\u54E1\u6570\u3060\u3051\u304A\u4F3A\u3044\u3067\u304D\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F"
    },
    r3Expert: {
      file: "r3_expert.mp3",
      text: "\u3042\u3001\u3059\u3067\u306B\u4FE1\u983C\u3067\u304D\u308B\u5C02\u9580\u5BB6\u69D8\u304C\u3044\u3089\u3063\u3057\u3083\u308B\u306E\u3067\u3059\u306D\uFF01\u7D20\u6674\u3089\u3057\u3044\u3067\u3059\u3002\u305F\u3060\u3001\u4ECA\u56DE\u306E\u4F01\u696D\u578BDC\u6CD5\u6539\u6B63\u306F\u793E\u52B4\u58EB\u69D8\u3084\u7A0E\u7406\u58EB\u69D8\u3067\u3082\u898B\u843D\u3068\u3055\u308C\u3084\u3059\u3044\u5C02\u9580\u9818\u57DF\u3068\u306A\u3063\u3066\u304A\u308A\u307E\u3059\u3002\u30BB\u30AB\u30F3\u30C9\u30AA\u30D4\u30CB\u30AA\u30F3\u3068\u3057\u3066\u60C5\u5831\u78BA\u8A8D\u3060\u3051\u3067\u3082\u3044\u304B\u304C\u3067\u3057\u3087\u3046\u304B\uFF1F"
    },
    r4Document: {
      file: "r4_document.mp3",
      text: "\u627F\u77E5\u3044\u305F\u3057\u307E\u3057\u305F\uFF01\u3054\u691C\u8A0E\u3044\u305F\u3060\u304D\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\u3002\u304A\u9001\u308A\u3059\u308B\u8CC7\u6599\u306B\u76F8\u9055\u304C\u306A\u3044\u3088\u3046\u3001\u5DEE\u3057\u652F\u3048\u306A\u3051\u308C\u3070\u9001\u4ED8\u5148\u306E\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3092\u304A\u4F3A\u3044\u3067\u304D\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F"
    },
    r5OtherScheme: {
      file: "r5_misunderstanding.mp3",
      text: "\u3042\u3001\u3054\u8A8D\u8B58\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\uFF01\u5B9F\u306FiDeCo\u3084\u500B\u4EBA\u306E\u5E74\u91D1\u3067\u306F\u306A\u304F\u3001\u4F1A\u793E\u5074\u306E\u793E\u4F1A\u4FDD\u967A\u6599\u3084\u7A0E\u91D1\u3082\u8EFD\u6E1B\u3067\u304D\u308B\u4F01\u696D\u578B\u306E\u5236\u5EA6\u306B\u3064\u3044\u3066\u306E\u6CD5\u6539\u6B63\u3068\u306A\u3063\u3066\u304A\u308A\u307E\u3059\u3002"
    },
    r7Absent: {
      file: "r7_absent.mp3",
      text: "\u627F\u77E5\u3044\u305F\u3057\u307E\u3057\u305F\u3002\u304A\u623B\u308A\u306E\u969B\u306B\u3054\u6848\u5185\u8CC7\u6599\u3092\u304A\u6E21\u3057\u3067\u304D\u308C\u3070\u3068\u5B58\u3058\u307E\u3059\u306E\u3067\u3001\u6050\u308C\u5165\u308A\u307E\u3059\u304C\u3054\u62C5\u5F53\u8005\u69D8\u306E\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u304B\u3001\u3054\u76F4\u901A\u306E\u304A\u96FB\u8A71\u756A\u53F7\u3092\u304A\u4F3A\u3044\u3057\u3066\u3082\u3088\u308D\u3057\u3044\u3067\u3057\u3087\u3046\u304B\uFF1F"
    }
  };
  var CLOSING_LINES = /* @__PURE__ */ new Set(["reject", "closing"]);
  var RECAP = {
    greeting: "\u6050\u308C\u5165\u308A\u307E\u3059\u30012026\u5E7412\u6708\u306E\u6CD5\u6539\u6B63\u306E\u4EF6\u3067\u3001\u3054\u62C5\u5F53\u8005\u69D8\u306B\u304A\u7E4B\u304E\u3044\u305F\u3060\u3051\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F",
    overview: "\u6050\u308C\u5165\u308A\u307E\u3059\u3001\u5FA1\u793E\u3067\u306F\u5F79\u54E1\u69D8\u306E\u9000\u8077\u91D1\u306E\u3054\u6E96\u5099\u306F\u4F55\u304B\u3055\u308C\u3066\u3044\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F",
    hearingAgeCount: "\u6050\u308C\u5165\u308A\u307E\u3059\u3001\u5F79\u54E1\u69D8\u3068\u5F93\u696D\u54E1\u69D8\u3092\u5408\u308F\u305B\u3066\u3001\u304A\u304A\u3088\u305D\u4F55\u540D\u69D8\u3067\u3044\u3089\u3063\u3057\u3083\u3044\u307E\u3059\u304B\uFF1F",
    hearingFiscalEmail: "\u6050\u308C\u5165\u308A\u307E\u3059\u3001\u5FA1\u793E\u306E\u6C7A\u7B97\u6708\u306F\u3044\u3064\u306B\u306A\u308A\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F",
    schedule: "\u6050\u308C\u5165\u308A\u307E\u3059\u3001\u6765\u9031\u306E\u6C34\u66DC\u65E514\u6642\u9803\u3067\u3057\u305F\u3089\u3001\u3054\u90FD\u5408\u3044\u304B\u304C\u3067\u3057\u3087\u3046\u304B\uFF1F",
    reschedule: "\u6050\u308C\u5165\u308A\u307E\u3059\u3001\u6728\u66DC\u65E5\u306E15\u6642\u9803\u3067\u3057\u305F\u3089\u3001\u3054\u90FD\u5408\u3044\u304B\u304C\u3067\u3057\u3087\u3046\u304B\uFF1F",
    contact: "\u6050\u308C\u5165\u308A\u307E\u3059\u3001\u3054\u62C5\u5F53\u8005\u69D8\u306E\u304A\u96FB\u8A71\u756A\u53F7\u304B\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3092\u4F3A\u3048\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F",
    r1NoSystem: "\u6050\u308C\u5165\u308A\u307E\u3059\u3001\u5FA1\u793E\u306E\u73FE\u5728\u306E\u5F93\u696D\u54E1\u6570\u3060\u3051\u4F3A\u3048\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F",
    r2Busy: "\u6050\u308C\u5165\u308A\u307E\u3059\u3001\u5FA1\u793E\u306E\u73FE\u5728\u306E\u5F93\u696D\u54E1\u6570\u3060\u3051\u4F3A\u3048\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F",
    r3Expert: "\u6050\u308C\u5165\u308A\u307E\u3059\u3001\u30BB\u30AB\u30F3\u30C9\u30AA\u30D4\u30CB\u30AA\u30F3\u3068\u3057\u3066\u60C5\u5831\u306E\u3054\u78BA\u8A8D\u3060\u3051\u3067\u3082\u3044\u304B\u304C\u3067\u3057\u3087\u3046\u304B\uFF1F",
    r4Document: "\u6050\u308C\u5165\u308A\u307E\u3059\u3001\u9001\u4ED8\u5148\u306E\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3092\u4F3A\u3048\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F",
    r5OtherScheme: "\u6050\u308C\u5165\u308A\u307E\u3059\u3001\u5FA1\u793E\u306E\u73FE\u5728\u306E\u5F93\u696D\u54E1\u6570\u3060\u3051\u4F3A\u3048\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F",
    r7Absent: "\u6050\u308C\u5165\u308A\u307E\u3059\u3001\u4F55\u6642\u9803\u3067\u3057\u305F\u3089\u304A\u623B\u308A\u306B\u306A\u308A\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F"
  };
  var PHASE_ANCHOR = {
    P0: "greeting",
    P1: "overview",
    P2: "hearingAgeCount",
    P3: "hearingAgeCount",
    P4: "hearingFiscalEmail",
    P5: "hearingFiscalEmail",
    P6: "schedule",
    P7: "schedule",
    P8: "contact",
    P9: "closing"
  };
  var audioUrl = (file) => `${AUDIO_BASE}${file}`;
  var YES = /(はい|ええ|うん|そうです|そうですね|そうしま|もちろん|ぜひ|是非|わかりました|分かりました|承知|了解|大丈夫|平気|問題ありませ|問題ない|構いませ|かまいませ|お願いし|いいです|いいよ|良いです|結構ですよ|それでいい|それで結構|それで大丈夫|それでお願い|オッケー|オーケー|ＯＫ|OK|どうぞ|お聞きし|聞いてみ|やってみ)/i;
  var NO = /(いいえ|いえいえ|いや|結構です(?!よ)|けっこうです|いりません|要りません|必要ありませ|必要ない|不要|遠慮|間に合って|やめ|やらない|やりません|しません|やめておき|興味(は|が)?(ない|ありませ)|関心(は|が)?(ない|ありませ)|見送|お断り|断りし|だめ|ダメ|駄目)/;
  var ASK_PURPOSE = /(ご用件|用件|ご用|どういった|どういう|どのような|どんな|なんの|何の|なんでしょ|どちら様|どちらさま|どなた|失礼ですが|どこの|お名前|会社名|目的|なにか|何か)(です|でしょ|ですか|ますか|かしら)?/;
  var TRANSFER = /(お待ち|少々|少し待|代わり|かわり|変わり|繋ぎ|つなぎ|お繋ぎ|呼んで|呼びま|確認しま|担当に|本人に|代表に|社長に|今呼び|まいります)/;
  var REFUSE_SALES = /(営業(の)?(お)?電話|営業は|セールス|勧誘|売り込み|お断り(し|する|して|です)|断るよう|取り次げ|取次(ぎ)?でき|お繋ぎでき|お受けでき|そういう(お)?電話|この手の電話|一切受け付け|間に合ってます)/;
  var SCHEDULE_NG = /(都合が悪|都合つか|都合がつか|予定が入って|埋まって|ふさがって|塞がって|空いて(ない|いない|ませ)|厳しい|難しい|無理です|無理かな|出張(で|が|に)|休みで|定休|別の日|他の日|ほかの日|再来週|変更|ずらし|遅らせ|もう少し先)/;
  var SCHEDULE_OK = /(大丈夫|空いて(ます|います|る)|問題ありませ|問題ない|構いませ|かまいませ|いけます|行けます|参加でき|出られ|可能です|お願いします|入れておき|それで(いい|結構|お願い)|承知|了解|調整し|都合つけ|押さえて|空けておき|みてみます)/;
  var ABSENT_NOW = /(不在|席を外|外出|出かけ|出払|留守|帰社|帰宅|退社|出張|戻り|戻って|お休み|休み|おりませ|今[はも]?い(ませ|ない))/;
  var RETURN_TIME = /(午前|午後|朝|昼|夕方|夜|明日|明後日|来週|週明け|\d{1,2}\s*時|\d{1,2}\s*日|後ほど|のちほど|いつでも|月曜|火曜|水曜|木曜|金曜)/;
  var DECLINE = /(対策(は|も)?(して|済|でき|ばっちり)|やってます|やっており|やっている|やってる|やってました|やっていました|導入(済|して(ます|おり|いる|いました))|(?:保険|制度|共済|年金|中退共|DC)[^。]{0,6}入って(ます|おり|いる)|間に合って|足りて(ます|いる|おり)|十分|充分|結構です(?!よ)|けっこうです|要りません|いりません|いらない|要らない|いらん|不要|必要(は)?(ない|ありませ)|興味(は|が)?(ない|ありませ)|関心(は|が)?(ない|ありませ)|お断り|遠慮(し|させ)|うちは(いい|平気)|もう(いい|やって|済ん))/;
  var SCHEDULE_CONTEXT = /(時間|日時|その日|来週|水曜|午前|午後|それで|日程|参加|伺い|お願いします|入れて)/;
  var HP_REFERENCE = /(ホームページ|ＨＰ|HP|ウェブ|Web|ウェブサイト|サイト|ネット|インターネット|オンライン上|URL|ＵＲＬ|弊社サイト)[^。]{0,16}(見|ご覧|載って|掲載|出て|ござい|あります|ありま|確認|調べ|検索|参照)/i;
  var POSTED_ELSEWHERE = /(載って(ます|います|る|おり)|掲載して(ます|います|おり)|出ております)|(ホームページ|ＨＰ|HP|サイト|ウェブ|ネット)[^。]{0,6}(通り|とおり|の通り)/i;
  var CONTACT_INTERROGATIVE = /(誰|どなた|どこ|どちら|何|なん|分か|わか|存じ|知ら|不明|教え)/;
  var CONTACT_TARGET = /(担当者名|担当者|担当|窓口|部署|お名前|名前|氏名)/;
  var CONTACT_SUBJECT = /(担当者名|担当者|担当|窓口|部署|お名前|名前|氏名|誰|どなた)/;
  var CONTACT_QUERY = /(分か|わか|判ら|知ら|存じ|確認|聞(き|け|い|く)|教え|どちら|なんて|何て|不明|いらっしゃ|でしょうか|ですか)/;
  var CONTACT_STANDALONE = /(担当部署|担当窓口|担当者名|(どこ|どちら|何)\s*(の)?\s*(部署|課|担当|窓口)|(誰|どなた)\s*(に|へ|宛て?)?\s*(お)?(伝え|繋|つな|回|渡)|誰宛|どなた宛)/;
  function isContactGuard(text) {
    if (TRANSFER.test(text) && !CONTACT_INTERROGATIVE.test(text)) return false;
    if (CONTACT_STANDALONE.test(text)) return true;
    if (CONTACT_TARGET.test(text) && /(誰|どなた)/.test(text)) return true;
    return CONTACT_SUBJECT.test(text) && CONTACT_QUERY.test(text);
  }
  function isContactNameAsked(text) {
    if (!isContactGuard(text)) return false;
    return /(担当者名|お名前|名前|氏名|誰宛|どなた宛)/.test(text);
  }
  var SELF_WORD = "(?:\u79C1|\u308F\u305F\u304F\u3057|\u308F\u305F\u3057|\u30EF\u30BF\u30B7|\u50D5|\u307C\u304F|\u30DC\u30AF|\u4FFA|\u304A\u308C|\u30AA\u30EC|\u81EA\u5206|\u3058\u3076\u3093|\u5F53\u65B9)";
  var SELF_SEP = "[\\s\u3001\uFF0C,]*";
  var SELF_IDENTIFIED = new RegExp(
    [
      `${SELF_WORD}${SELF_SEP}(?:\u3067\u3059|\u3067\u3054\u3056\u3044\u307E\u3059)`,
      `${SELF_WORD}${SELF_SEP}\u304C${SELF_SEP}(?:\u62C5\u5F53|\u7A93\u53E3|\u8CAC\u4EFB\u8005|\u3084\u3063\u3066|\u898B\u3066|\u305D\u3046\u3067\u3059)`,
      `(?:\u62C5\u5F53|\u7A93\u53E3)${SELF_SEP}\u3067\u3059`,
      `${SELF_WORD}${SELF_SEP}\u3067${SELF_SEP}(?:\u304A\u4F3A\u3044|\u4F3A\u3044|\u627F\u308A|\u304A\u53D7\u3051|\u5927\u4E08\u592B|\u7D50\u69CB)`
    ].join("|")
  );
  var ANSWERED_CALL = /(もしもし|株式会社|有限会社|合同会社|でございます|社長の|代表の|担当の|私が|わたくし)/;
  var PERSON_PHRASES = [
    [/(私|自分|わたし)(と|や|＋)(妻|夫|家内|主人|嫁|息子|娘|息子夫婦)/, 2],
    [/夫婦(で|だけ|二人|2人)?/, 2],
    [/(私|自分|わたし)(だけ|一人|ひとり)/, 1],
    [/(一人|ひとり|1人)(だけ|です|ですね|でやって)/, 1]
  ];
  var EMAIL_UNAVAILABLE = /(メール|アドレス)[^。]{0,12}(苦手|使って(ない|いない|おりませ|ません)|持って(ない|いない|おりませ)|見ない|分からない|わからない|やってない)/;
  var CURRENT_NUMBER = /(この|こちらの|こっちの|今の|いまの)\s*(番号|電話|携帯|ケータイ)|(今|いま)\s*(お)?(かけ|掛け)て(もらって|いただいて|頂いて|られて|くれて)?(る|い)|(今|いま)\s*(かかって|掛かって)(る|い|き)|(発信|着信)\s*(元|の)?\s*(番号|電話)|表示\s*(されて(る|いる)|の)\s*(番号|電話)/;
  var CURRENT_NUMBER_REFUSED = /(じゃなく|ではなく|でなく|じゃない|ではない|以外|は(だめ|ダメ|駄目|困|使え|繋が|つなが))/;
  function isCurrentNumber(text) {
    return CURRENT_NUMBER.test(text) && !CURRENT_NUMBER_REFUSED.test(text);
  }
  var CURRENT_NUMBER_LABEL = "\u767A\u4FE1\u756A\u53F7\uFF08\u4ECA\u304A\u96FB\u8A71\u3057\u3066\u3044\u308B\u756A\u53F7\uFF09";
  var TIME_SLOT = /(午前|午後|朝|昼|夕方|夜|前半|後半|早い時間|遅い時間|\d{1,2}\s*時|\d{1,2}\s*日|来週|再来週|明日|明後日|週明け|月曜|火曜|水曜|木曜|金曜)/;
  var PUBLIC_BODY_CONFUSION = /(お国|国が|国の|お役所|役所|市役所|区役所|町役場|公的|行政|官公庁|厚労省|厚生労働省|年金機構|年金事務所|社会保険事務所|商工会|商工会議所|税務署|ハローワーク|労働基準監督署|公務員|職員|担当官|補助金|助成金|給付金)/;
  var EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
  var PHONE_RE = /0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}/;
  var COUNT_RE = /(\d+|[〇一二三四五六七八九十]{1,4})\s*(名|人)/;
  var AGE_RE = /(\d{1,3})\s*(歳|才)|(?:今年で|年齢は)\s*(\d{1,3})/;
  var MONTH_RE = /(\d{1,2}|[一二三四五六七八九十]{1,3})\s*月/;
  var OFFICER_COUNT = /(?:役員|取締役|重役|代表者)[^。、]{0,12}?(\d{1,3}|[〇一二三四五六七八九十]{1,4})\s*(?:名|人)/;
  var OFFICER_COUNT_REV = /(\d{1,3}|[〇一二三四五六七八九十]{1,4})\s*(?:名|人)[^。、]{0,8}?(?:役員|取締役|重役)/;
  var INSURED_COUNT = /(?:社会保険|社保|厚生年金|健康保険|従業員|社員|スタッフ|正社員|加入)[^。、]{0,12}?(\d{1,3}|[〇一二三四五六七八九十]{1,4})\s*(?:名|人)/;
  var INSURED_COUNT_REV = /(\d{1,3}|[〇一二三四五六七八九十]{1,4})\s*(?:名|人)[^。、]{0,10}?(?:社会保険|社保|厚生年金|加入|従業員|社員)/;
  var FISCAL_MONTH = /(?:決算|期末|決算期)[^。、]{0,8}?(\d{1,2}|[一二三四五六七八九十]{1,3})\s*月/;
  var FISCAL_MONTH_REV = /(\d{1,2}|[一二三四五六七八九十]{1,3})\s*月\s*(?:が|の|で)?\s*(?:決算|締め)/;
  var SELF_AGE = /(?:私|自分|わたし|わたくし|当方|年齢|今年で|歳は)[^。、]{0,8}?(\d{1,3}|[一二三四五六七八九十]{1,3})\s*(?:歳|才|になり)/;
  var KANJI_DIGITS = "\u3007\u4E00\u4E8C\u4E09\u56DB\u4E94\u516D\u4E03\u516B\u4E5D";
  function toNumber(raw) {
    const s = raw.trim();
    if (/^\d+$/.test(s)) return Number(s);
    if (!/^[〇一二三四五六七八九十]+$/.test(s)) return null;
    if (!s.includes("\u5341")) {
      let n = 0;
      for (const ch of s) {
        const d = KANJI_DIGITS.indexOf(ch);
        if (d < 0) return null;
        n = n * 10 + d;
      }
      return n;
    }
    const [tensPart = "", onesPart = ""] = s.split("\u5341");
    const tens = tensPart === "" ? 1 : KANJI_DIGITS.indexOf(tensPart);
    const ones = onesPart === "" ? 0 : KANJI_DIGITS.indexOf(onesPart);
    if (tens < 0 || ones < 0) return null;
    return tens * 10 + ones;
  }
  function phraseCount(text) {
    for (const [pattern, count] of PERSON_PHRASES) if (pattern.test(text)) return count;
    return null;
  }
  function firstNumber(text, patterns) {
    for (const p of patterns) {
      const m = p.exec(text);
      const n = m?.[1] ? toNumber(m[1]) : null;
      if (n !== null && n > 0) return n;
    }
    return null;
  }
  function bulkExtract(text) {
    const facts = {};
    const officers = firstNumber(text, [OFFICER_COUNT, OFFICER_COUNT_REV]);
    const insured = firstNumber(text, [INSURED_COUNT, INSURED_COUNT_REV]);
    const month = firstNumber(text, [FISCAL_MONTH, FISCAL_MONTH_REV]);
    const age = firstNumber(text, [SELF_AGE]);
    if (officers !== null) facts.officers = officers;
    if (insured !== null) facts.insured = insured;
    if (month !== null && month >= 1 && month <= 12) facts.fiscalMonth = month;
    if (age !== null && age >= 18 && age <= 99) facts.age = age;
    const email = EMAIL_RE.exec(text.replace(/\s/g, ""))?.[0];
    const phone = PHONE_RE.exec(text.replace(/\s/g, ""))?.[0];
    if (email) facts.email = email;
    if (phone) facts.phone = phone;
    return facts;
  }
  var AGE_ERA = /(\d{2})\s*代/;
  var BARE_COUNT = /(\d{1,4}|[〇一二三四五六七八九十]{1,4})\s*(?:名|人)/;
  var REASK_PREFIX = [
    "\u6050\u308C\u5165\u308A\u307E\u3059\u3001\u3082\u3046\u4E00\u5EA6\u304A\u4F3A\u3044\u3067\u304D\u307E\u3059\u3067\u3057\u3087\u3046\u304B\u3002",
    "\u304A\u624B\u6570\u3092\u304A\u304B\u3051\u3044\u305F\u3057\u307E\u3059\u3002",
    "\u5FF5\u306E\u305F\u3081\u78BA\u8A8D\u3055\u305B\u3066\u304F\u3060\u3055\u3044\u3002"
  ];
  var EARLY_PHASES = /* @__PURE__ */ new Set(["P0", "P1"]);
  var DialogEngine = class _DialogEngine {
    constructor(state2) {
      this.state = state2;
    }
    state;
    pending = null;
    /** 直前の発話で一括抽出できた項目（画面に「まとめ聞きで取得」と出すため） */
    harvested = [];
    /** すでに読み上げた収録台本。同じ録音を続けて流さないために持つ。 */
    said = /* @__PURE__ */ new Set();
    /** 切り返しで投げた質問（従業員数だけ／連絡先だけ） */
    expecting = null;
    /** 想定外の発話が続いた回数。立て直しの段階を決める。 */
    unknownStreak = 0;
    /**
     * R2（多忙）の切り返しを再生済みか。
     * R2 は「30秒だけ要点をお伝えして…」という一度きりの切り返しなので、
     * 同じ通話で二度流すと会話が前に進まずループする。1通話1回に制限する。
     */
    busyPitchDone = false;
    /** 各スロットを聞き直した回数。前置きを変えて同じ言い回しを続けないために持つ。 */
    reasked = /* @__PURE__ */ new Map();
    /** 要点だけを聞き直した切り返し。同じ聞き直しを繰り返さないために持つ。 */
    recapped = /* @__PURE__ */ new Set();
    /** 言い直した台本。同じ台本を何度も流し直さないために持つ。 */
    replayed = /* @__PURE__ */ new Set();
    /** 資料を郵送に切り替える案内を済ませたか。同じ案内を繰り返さないために持つ。 */
    postalOffered = false;
    /** 取次ぎ先を尋ね返された回数。2回目は食い下がらない。 */
    contactUnknownAsks = 0;
    /** 「ホームページを見て」と言われた回数。2回目は食い下がらない。 */
    hpDeflections = 0;
    /** 一度でも HP 参照があったか。以後はメールアドレスの催促をしない。 */
    hpReferenced = false;
    /**
     * HP 参照の切り返し（オンラインでのご挨拶の打診）を流したターンの位置。
     * 受付段階では日程フェーズへ進めないため、直後の「大丈夫です」をフェーズでは
     * 承諾と判別できない。打診の直後かどうかをこれで見る。
     */
    meetingOfferedAt = -1;
    /** 公的機関との誤認を訂正済みか。同じ訂正を繰り返さないために持つ。 */
    publicBodyCorrected = false;
    /** R7（不在）対応に切り替わっているか。戻り時間と折り返し先の確定だけを行う。 */
    absentMode = false;
    /** 不在対応で何ターン粘ったか。確認が取れないまま長引かせないための上限。 */
    absentTurns = 0;
    /** 不在対応で何を聞き終えたか。同じ質問を繰り返さないために持つ。 */
    absentAsked = /* @__PURE__ */ new Set();
    /**
     * 連続して拒絶された回数（多忙・断りをまとめて数える）。
     * 種類が違っても2回続けて断られた時点で食い下がらない。
     */
    refusalStreak = 0;
    /** 直前に流した収録台本。言い直しはフェーズではなくこれを基準にする。 */
    lastLine = null;
    /** 架電開始の第一声。 */
    greeting() {
      return this.say("greeting", "P0", [], "\u67B6\u96FB\u958B\u59CB");
    }
    /** 相手の発話を受けて応答を1つ返す。state は破壊的に更新される。 */
    respond(customerText) {
      const text = customerText.trim();
      const fired = detectGuardrails(text);
      for (const g2 of fired) {
        if (!this.state.firedGuardrails.includes(g2)) this.state.firedGuardrails.push(g2);
      }
      if (!fired.includes("R2") && !this.isDecline(text)) this.refusalStreak = 0;
      this.harvested = this.harvest(text);
      let collected = this.collectExpected(text);
      if (!collected && EARLY_PHASES.has(this.state.phase) && !this.state.hearing.H5) {
        const n = toNumber(BARE_COUNT.exec(text)?.[1] ?? "") ?? phraseCount(text);
        if (n !== null && n > 0) {
          applyExtracted(this.state, { H5: `${n}\u540D` });
          if (!this.harvested.includes("H5")) this.harvested.push("H5");
          collected = "headcount";
        }
      }
      if (this.askingPhone() && isCurrentNumber(text)) return this.acceptCurrentNumber(text, fired);
      const g = this.byGuardrail(text, fired);
      if (g) return g;
      if (collected === "headcount") {
        this.unknownStreak = 0;
        this.refusalStreak = 0;
        return this.say(
          "hearingFiscalEmail",
          this.toPhase("P5"),
          fired,
          "\u5207\u308A\u8FD4\u3057\u3078\u306E\u56DE\u7B54\u304B\u3089 H5 \u3092\u53D6\u5F97 \u2192 \u6C7A\u7B97\u6708\u3068\u9001\u4ED8\u5148\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3078"
        );
      }
      if (fired.includes("R2") && this.busyPitchDone) {
        const cont = this.afterBusy(fired);
        if (cont) return cont;
      }
      if (this.absentMode && !this.state.ended) {
        return this.absentFollowUp(text, fired);
      }
      if (this.isContactGuard(text)) return this.handleContactUnknown(fired);
      if (this.isHpReference(text)) return this.handleHpReference(fired);
      if (this.isDecline(text)) {
        this.refusalStreak++;
        return this.handleDecline(fired);
      }
      switch (this.state.phase) {
        case "P0":
          return this.p0(text, fired);
        case "P1":
          return this.p1(text, fired);
        case "P2":
        case "P3":
          return this.hearingAgeCount(text, fired);
        case "P4":
        case "P5":
          return this.hearingFiscalEmail(text, fired);
        case "P6":
        case "P7":
          return this.p7(text, fired);
        case "P8":
          return this.p8(text, fired);
        case "P9":
          return this.speakOnly(
            "\u672C\u65E5\u306F\u304A\u6642\u9593\u3092\u3044\u305F\u3060\u304D\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3057\u305F\u3002\u5931\u793C\u3044\u305F\u3057\u307E\u3059\u3002",
            "END",
            fired,
            "\u7DE0\u3081\u5B8C\u4E86"
          );
        default:
          return this.speakOnly("\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3057\u305F\u3002\u5931\u793C\u3044\u305F\u3057\u307E\u3059\u3002", "END", fired, "\u7D42\u8A71");
      }
    }
    /**
     * 発話から人数・決算月・年齢・連絡先を拾って state に入れる。
     * すでに取得済みの項目は上書きしない（取りこぼし防止と同じ方針）。
     * 戻り値は「今回新しく埋まったヒアリング項目」。
     */
    harvest(text) {
      const b = bulkExtract(text);
      const facts = {};
      const filled = [];
      const put = (id, value) => {
        if (this.state.hearing[id]) return;
        facts[id] = value;
        filled.push(id);
      };
      if (b.officers !== void 0) put("H4", `${b.officers}\u540D\uFF08${text}\uFF09`);
      if (b.insured !== void 0) put("H5", `${b.insured}\u540D`);
      if (b.fiscalMonth !== void 0) put("H7", `${b.fiscalMonth}\u6708`);
      if (b.age !== void 0) put("H3", `${b.age}\u6B73`);
      if (b.email && !this.state.email) facts.email = b.email;
      if (b.phone && !this.state.callbackPhone) facts.callback_phone = b.phone;
      if (filled.length > 0 || facts.email || facts.callback_phone) applyExtracted(this.state, facts);
      return filled;
    }
    /**
     * 「従業員数だけ」「連絡先だけ」など切り返しで投げた質問への回答を回収する。
     * 文脈語が無い回答（「20人です」）でも、直前に聞いた項目としてなら受け取れる。
     */
    collectExpected(text) {
      if (!this.expecting) return null;
      if (this.expecting === "headcount") {
        const n = this.state.hearing.H5 ? null : toNumber(BARE_COUNT.exec(text)?.[1] ?? "") ?? phraseCount(text);
        if (n === null || n <= 0) return null;
        applyExtracted(this.state, { H5: `${n}\u540D` });
        if (!this.harvested.includes("H5")) this.harvested.push("H5");
        this.expecting = null;
        return "headcount";
      }
      if (this.state.email || this.state.callbackPhone) {
        this.expecting = null;
        return "contact";
      }
      return null;
    }
    // ---------- ガードレール優先の分岐（設計書 §5） ----------
    byGuardrail(text, fired) {
      const has = (id) => fired.includes(id);
      if (has("R5")) {
        this.unknownStreak = 0;
        if (PUBLIC_BODY_CONFUSION.test(text) && !this.publicBodyCorrected) {
          this.publicBodyCorrected = true;
          return this.speakOnly(
            "\u7D1B\u3089\u308F\u3057\u304F\u3066\u7533\u3057\u8A33\u3054\u3056\u3044\u307E\u305B\u3093\u3002\u5236\u5EA6\u306F\u539A\u751F\u52B4\u50CD\u7701\u306E\u7BA1\u8F44\u3067\u3059\u304C\u3001\u79C1\u3069\u3082\u306F\u6C11\u9593\u306E\u5C0E\u5165\u652F\u63F4\u4E8B\u696D\u8005\u3067\u3054\u3056\u3044\u307E\u3059\u3002",
            this.state.phase,
            fired,
            "R5: \u516C\u7684\u6A5F\u95A2\u3068\u306E\u8AA4\u8A8D\u3092\u5373\u5EA7\u306B\u8A02\u6B63\uFF08\u9332\u97F3\u306A\u3057\u30FB\u97F3\u58F0\u5408\u6210\uFF09"
          );
        }
        const reply = this.guardrailReply(
          "r5OtherScheme",
          this.state.phase,
          fired,
          "R5: iDeCo\u30FB\u500B\u4EBA\u5E74\u91D1\u3068\u306E\u52D8\u9055\u3044\u3092\u8A02\u6B63"
        );
        if (reply) return reply;
      }
      if (has("R7")) {
        this.unknownStreak = 0;
        const absent = ABSENT_NOW.test(text);
        if (!this.said.has("r7Absent")) {
          this.expecting = "contact";
          this.absentMode = absent;
          return this.say(
            "r7Absent",
            this.state.phase,
            fired,
            absent ? "R7: \u4E0D\u5728 \u2192 \u623B\u308A\u306E\u969B\u306E\u9023\u7D61\u5148\u3092\u78BA\u4FDD" : "R7: \u6C7A\u88C1\u6A29\u306A\u3057 \u2192 \u5224\u65AD\u3067\u304D\u308B\u65B9\u306E\u9023\u7D61\u5148\u3092\u78BA\u4FDD"
          );
        }
        if (absent || this.absentMode) {
          this.absentMode = true;
          return this.absentFollowUp(text, fired);
        }
      }
      if (has("R1") && this.state.phase !== "P8") {
        this.unknownStreak = 0;
        this.expecting = "headcount";
        const reply = this.guardrailReply(
          "r1NoSystem",
          this.toPhase("P3"),
          fired,
          "R1: \u65AD\u308A\u5224\u5B9A\u3092\u7981\u6B62\u3057\u3001\u672A\u5C0E\u5165\u4F01\u696D\u5411\u3051\u306E\u8A34\u6C42\uFF0B\u4EBA\u6570\u78BA\u8A8D\u3078"
        );
        if (reply) return reply;
      }
      if (has("R3")) {
        this.unknownStreak = 0;
        const reply = this.guardrailReply(
          "r3Expert",
          this.state.phase,
          fired,
          "R3: \u5C02\u9580\u5BB6\u3092\u5426\u5B9A\u305B\u305A\u30BB\u30AB\u30F3\u30C9\u30AA\u30D4\u30CB\u30AA\u30F3\u3068\u3057\u3066\u63D0\u6848"
        );
        if (reply) return reply;
      }
      if (has("R4") && (this.hpReferenced || this.isHpReference(text))) {
        return this.handleHpReference(fired);
      }
      if (has("R4")) {
        this.unknownStreak = 0;
        this.expecting = "contact";
        const reply = this.guardrailReply(
          "r4Document",
          this.state.phase,
          fired,
          "R4: \u9001\u4ED8\u3092\u53D7\u3051\u305F\u3046\u3048\u3067\u9001\u4ED8\u5148\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3092\u78BA\u5B9A"
        );
        if (reply) return reply;
      }
      const answeringCallback = this.state.phase === "P8" && (this.pending === "callbackPhone" || this.pending === "callbackWindow");
      if (has("R2") && !this.busyPitchDone && !answeringCallback) {
        this.unknownStreak = 0;
        this.refusalStreak++;
        if (this.refusalStreak >= 2) {
          return this.say("reject", this.toPhase("P0X"), fired, "2\u56DE\u9023\u7D9A\u306E\u62D2\u7D76 \u2192 \u98DF\u3044\u4E0B\u304C\u3089\u305A\u4E01\u5BE7\u306B\u7D42\u8A71");
        }
        this.expecting = "headcount";
        this.busyPitchDone = true;
        return this.say("r2Busy", this.toPhase("P3"), fired, "R2: 30\u79D2\u3067\u8981\u70B9\u3092\u4F1D\u3048\u3066\u4EBA\u6570\u78BA\u8A8D\u3078");
      }
      return null;
    }
    // ---------- フェーズ別の意図判定 ----------
    p0(text, fired) {
      if (REFUSE_SALES.test(text)) {
        this.unknownStreak = 0;
        return this.say("reject", "P0X", fired, "\u53D7\u4ED8\u30D6\u30ED\u30C3\u30AF \u2192 \u4E01\u5BE7\u306B\u64A4\u9000");
      }
      if (TRANSFER.test(text) || ASK_PURPOSE.test(text)) {
        this.unknownStreak = 0;
        return this.say(
          "overview",
          "P1",
          fired,
          TRANSFER.test(text) ? "\u53D6\u6B21\u304E\u767A\u751F \u2192 \u6CD5\u6539\u6B63\u306E\u6982\u8981" : "\u7528\u4EF6\u3092\u554F\u308F\u308C\u305F \u2192 \u6CD5\u6539\u6B63\u306E\u6982\u8981"
        );
      }
      if (SELF_IDENTIFIED.test(text)) {
        this.unknownStreak = 0;
        return this.say("overview", "P1", fired, "\u672C\u4EBA\u304C\u5FDC\u7B54\uFF08\u53D7\u4ED8\u7A81\u7834\uFF09 \u2192 \u6CD5\u6539\u6B63\u306E\u6982\u8981");
      }
      if (YES.test(text) || ANSWERED_CALL.test(text)) {
        this.unknownStreak = 0;
        return this.say("overview", "P1", fired, "\u76F8\u624B\u304C\u5FDC\u7B54 \u2192 \u6CD5\u6539\u6B63\u306E\u6982\u8981");
      }
      return this.repair(fired, "\u53D7\u4ED8\u306E\u53CD\u5FDC\u3092\u5224\u5B9A\u3067\u304D\u305A");
    }
    p1(text, fired) {
      if (!this.said.has("overview")) {
        return this.say("overview", "P1", fired, "\u62C5\u5F53\u8005\u63A5\u7D9A \u2192 \u6CD5\u6539\u6B63\u306E\u6982\u8981");
      }
      this.unknownStreak = 0;
      return this.say("hearingAgeCount", "P3", fired, "\u6982\u8981\u3078\u306E\u53CD\u5FDC \u2192 \u5E74\u9F62\u5C64\u3068\u4EBA\u6570\u306E\u30D2\u30A2\u30EA\u30F3\u30B0");
    }
    /** P2/P3: 年齢層・人数を聞いている場面。 */
    hearingAgeCount(text, fired) {
      const got = [...this.harvested];
      if (!this.state.hearing.H5) {
        const n = toNumber(BARE_COUNT.exec(text)?.[1] ?? "") ?? phraseCount(text);
        if (n !== null && n > 0) {
          applyExtracted(this.state, { H5: `${n}\u540D` });
          got.push("H5");
        }
      }
      if (!this.state.hearing.H3) {
        const era = AGE_ERA.exec(text)?.[1];
        if (era) {
          applyExtracted(this.state, { H3: `${era}\u4EE3` });
          got.push("H3");
        }
      }
      const known = this.state.hearing.H3 ?? this.state.hearing.H4 ?? this.state.hearing.H5;
      if (got.length === 0 && (!YES.test(text) || !known)) {
        return this.repair(fired, "\u5E74\u9F62\u5C64\u30FB\u4EBA\u6570\u306E\u56DE\u7B54\u3068\u3057\u3066\u8AAD\u307F\u53D6\u308C\u305A");
      }
      this.unknownStreak = 0;
      this.expecting = null;
      const note = got.length > 0 ? `${[...new Set(got)].join("\u30FB")} \u3092\u53D6\u5F97` : "\u53CD\u5FDC\u3092\u78BA\u8A8D";
      return this.say("hearingFiscalEmail", "P5", fired, `${note} \u2192 \u6C7A\u7B97\u6708\u3068\u9001\u4ED8\u5148\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3078`);
    }
    /** P4/P5: 決算月・メールアドレスを聞いている場面。 */
    hearingFiscalEmail(text, fired) {
      const got = [...this.harvested];
      if (!this.state.hearing.H7) {
        const m = toNumber(MONTH_RE.exec(text)?.[1] ?? "");
        if (m !== null && m >= 1 && m <= 12) {
          applyExtracted(this.state, { H7: `${m}\u6708` });
          got.push("H7");
        }
      }
      if (this.state.email && !got.includes("email") && EMAIL_RE.test(text.replace(/\s/g, ""))) {
        got.push("email");
      }
      if (got.length === 0 && EMAIL_UNAVAILABLE.test(text) && !this.postalOffered) {
        this.postalOffered = true;
        this.unknownStreak = 0;
        return this.speakOnly(
          this.state.hearing.H7 ? "\u627F\u77E5\u3044\u305F\u3057\u307E\u3057\u305F\u3002\u305D\u308C\u3067\u306F\u8CC7\u6599\u306F\u90F5\u9001\u3067\u304A\u9001\u308A\u3044\u305F\u3057\u307E\u3059\u3002" : "\u627F\u77E5\u3044\u305F\u3057\u307E\u3057\u305F\u3002\u305D\u308C\u3067\u306F\u3001\u5FA1\u793E\u306E\u6C7A\u7B97\u6708\u3060\u3051\u4F3A\u3048\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F\u8CC7\u6599\u306F\u90F5\u9001\u3067\u3082\u304A\u9001\u308A\u3067\u304D\u307E\u3059\u3002",
          this.state.phase,
          fired,
          "\u30E1\u30FC\u30EB\u304C\u4F7F\u3048\u306A\u3044 \u2192 \u90F5\u9001\u306B\u5207\u308A\u66FF\u3048\u3066\u6C7A\u7B97\u6708\u306E\u307F\u78BA\u8A8D"
        );
      }
      if (got.length === 0 && !YES.test(text)) {
        return this.repair(fired, "\u6C7A\u7B97\u6708\u30FB\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u306E\u56DE\u7B54\u3068\u3057\u3066\u8AAD\u307F\u53D6\u308C\u305A");
      }
      this.unknownStreak = 0;
      this.expecting = null;
      return this.say(
        "schedule",
        "P7",
        fired,
        `${[...new Set(got)].join("\u30FB") || "\u53CD\u5FDC\u3092\u78BA\u8A8D"} \u3092\u53D6\u5F97 \u2192 \u30AA\u30F3\u30E9\u30A4\u30F3\u5546\u8AC7\u306E\u65E5\u7A0B\u6253\u8A3A`
      );
    }
    /** P6/P7: 日程を詰めている場面。 */
    p7(text, fired) {
      if (/(ズーム|zoom|オンライン|ウェブ|web|リモート|url|URL)/i.test(text) && /(何|なに|わからない|分からない|使えない|できない|詳しくない|苦手|不安|やったこと)/.test(text)) {
        this.unknownStreak = 0;
        return this.speakOnly(
          "\u30B9\u30DE\u30FC\u30C8\u30D5\u30A9\u30F3\u3067\u3082\u53C2\u52A0\u3067\u304D\u307E\u3059\u3002\u30E1\u30FC\u30EB\u3067\u304A\u9001\u308A\u3059\u308BURL\u3092\u30BF\u30C3\u30D7\u3044\u305F\u3060\u304F\u3060\u3051\u3067\u3059\u306E\u3067\u3001\u96E3\u3057\u3044\u64CD\u4F5C\u306F\u3054\u3056\u3044\u307E\u305B\u3093\u3002",
          "P7",
          fired,
          "\u6761\u4EF6\u5206\u5C90: \u30AA\u30F3\u30E9\u30A4\u30F3\u5546\u8AC7\u306E\u8AAC\u660E"
        );
      }
      if (/(遠い|距離|来られ|お越し|伺うの)/.test(text)) {
        this.unknownStreak = 0;
        return this.speakOnly(
          "\u30AA\u30F3\u30E9\u30A4\u30F3\u3067\u3059\u306E\u3067\u3001\u3054\u79FB\u52D5\u3084\u3054\u6765\u793E\u306F\u4E0D\u8981\u3067\u3054\u3056\u3044\u307E\u3059\u3002",
          "P7",
          fired,
          "\u6761\u4EF6\u5206\u5C90: \u30AA\u30F3\u30E9\u30A4\u30F3\u306A\u306E\u3067\u79FB\u52D5\u306F\u4E0D\u8981"
        );
      }
      if (SCHEDULE_NG.test(text) && !SCHEDULE_OK.test(text)) {
        if (!this.said.has("reschedule")) {
          this.unknownStreak = 0;
          return this.say("reschedule", "P7", fired, "\u65E5\u7A0BNG \u2192 \u4EE3\u66FF\u65E5\u7A0B\u3092\u63D0\u793A");
        }
        return this.repair(fired, "\u4EE3\u66FF\u65E5\u7A0B\u3082\u5408\u308F\u305A");
      }
      if ((YES.test(text) || SCHEDULE_OK.test(text) || TIME_SLOT.test(text)) && !NO.test(text)) {
        const sc = DEMO_SCENARIO;
        applyExtracted(this.state, {
          appointment_date: sc.proposedDate,
          appointment_time: sc.proposedTime,
          zoom_agreed: true,
          duration_agreed: true
        });
        this.unknownStreak = 0;
        this.pending = this.state.callbackPhone ? null : "callbackPhone";
        return this.say("contact", "P8", fired, "\u65E5\u7A0B\u78BA\u5B9A \u2192 \u9023\u7D61\u5148\u306E\u78BA\u8A8D(P8)");
      }
      return this.repair(fired, "\u65E5\u7A0B\u306E\u53EF\u5426\u3092\u5224\u5B9A\u3067\u304D\u305A");
    }
    // ---------- P8: ヒアリング7項目 ----------
    p8(text, fired) {
      const notes = [];
      if (this.harvested.length > 0) {
        notes.push(`\u307E\u3068\u3081\u805E\u304D\u3067 ${this.harvested.join("\u30FB")} \u3092\u540C\u6642\u53D6\u5F97`);
      }
      if (this.pending) {
        if (this.isFilled(this.pending)) {
          notes.push(`${this.pending} \u306F\u56DE\u7B54\u6E08\u307F\u306E\u305F\u3081\u8CEA\u554F\u3092\u30B9\u30AD\u30C3\u30D7`);
        } else {
          const { facts, ok } = this.extract(this.pending, text);
          if (ok) {
            applyExtracted(this.state, facts);
            notes.push(`${this.pending} \u3092\u53D6\u5F97`);
          } else {
            const attempt = this.reasked.get(this.pending) ?? 0;
            this.reasked.set(this.pending, attempt + 1);
            const prefix = REASK_PREFIX[attempt % REASK_PREFIX.length] ?? "";
            return this.speakOnly(
              `${prefix}${this.askText(this.pending)}`,
              "P8",
              fired,
              `${this.pending} \u304C\u805E\u304D\u53D6\u308C\u305A\u518D\u8CEA\u554F`
            );
          }
        }
      }
      this.unknownStreak = 0;
      return this.advanceP8(notes, fired);
    }
    /**
     * P8 で次に聞く項目へ進める。全部揃っていればカレンダー登録依頼 → 締め(P9)。
     * lead は次の質問の前に添える一言（「こちらの番号宛にご連絡します」など）。
     * 締めは録音をそのまま流す（表示テキストと音声を食い違わせないため lead は付けない）。
     */
    advanceP8(notes, fired, lead = "") {
      const nextSlot = this.nextSlot();
      if (!nextSlot) {
        this.pending = null;
        if (!this.state.calendarRequested) {
          const sc = DEMO_SCENARIO;
          return this.speakOnly(
            `${lead}\u62C5\u5F53\u306E\u4E88\u5B9A\u306E\u517C\u306D\u5408\u3044\u3067\u3001\u3082\u3057\u65E5\u7A0B\u5909\u66F4\u306B\u306A\u308A\u307E\u3059\u3068\u6B21\u56DE\u306E\u3054\u6848\u5185\u304C\u304B\u306A\u308A\u5148\u306B\u306A\u308B\u53EF\u80FD\u6027\u304C\u3054\u3056\u3044\u307E\u3059\u3002\u304A\u624B\u6570\u3067\u3059\u304C${sc.proposedDate}${sc.proposedTime}\u3067\u3001\u4E00\u65E6\u30AB\u30EC\u30F3\u30C0\u30FC\u306B\u3054\u4E88\u5B9A\u3060\u3051\u5165\u308C\u3066\u304A\u3044\u3066\u3044\u305F\u3060\u3051\u307E\u3059\u3068\u52A9\u304B\u308A\u307E\u3059\u3002`,
            "P8",
            fired,
            `${notes.join(" / ") || "\u53D6\u5F97\u5B8C\u4E86"} \u2192 \u30AB\u30EC\u30F3\u30C0\u30FC\u767B\u9332\u4F9D\u983C\uFF08\u9332\u97F3\u306A\u3057\u30FB\u97F3\u58F0\u5408\u6210\uFF09`
          );
        }
        return this.say(
          "closing",
          "P9",
          fired,
          `${notes.join(" / ") || "\u53D6\u5F97\u5B8C\u4E86"} \u2192 7\u9805\u76EE\uFF0B\u9023\u7D61\u5148\u304C\u63C3\u3063\u305F\u306E\u3067\u7DE0\u3081(P9)`
        );
      }
      this.pending = nextSlot;
      return this.speakOnly(
        `${lead}${this.askText(nextSlot)}`,
        "P8",
        fired,
        `${notes.length > 0 ? notes.join(" / ") + " \u2192 " : ""}\u6B21\u306F ${nextSlot}\uFF08\u9332\u97F3\u306A\u3057\u30FB\u97F3\u58F0\u5408\u6210\uFF09`
      );
    }
    /** 折り返し先の電話番号を聞いている場面か（P8 の連絡先確認・不在時の折り返し先確認）。 */
    askingPhone() {
      if (this.state.callbackPhone || this.state.ended) return false;
      return this.state.phase === "P8" && this.pending === "callbackPhone" || this.absentMode;
    }
    /**
     * 「この番号でいいです」を受けて、発信先の番号を連絡先として確定する。
     * 聞き直しはせず、メールアドレスが未取得ならそれを、取得済みなら残りの確認事項へ進む。
     */
    acceptCurrentNumber(text, fired) {
      applyExtracted(this.state, { callback_phone: CURRENT_NUMBER_LABEL, is_current_number: true });
      this.unknownStreak = 0;
      this.expecting = null;
      if (this.absentMode) return this.absentFollowUp(text, fired);
      const ack = "\u627F\u77E5\u3044\u305F\u3057\u307E\u3057\u305F\uFF01\u3067\u306F\u3053\u3061\u3089\u306E\u756A\u53F7\u5B9B\u306B\u3054\u9023\u7D61\u3092\u5DEE\u3057\u4E0A\u3052\u307E\u3059\u306D\u3002";
      const note = "\u767A\u4FE1\u756A\u53F7\u306E\u6307\u5B9A \u2192 \u3053\u306E\u756A\u53F7\u3067\u9023\u7D61\u5148\u3092\u78BA\u5B9A";
      if (!this.state.email) {
        this.pending = "email";
        return this.speakOnly(
          `${ack}\u5DEE\u3057\u652F\u3048\u306A\u3051\u308C\u3070\u9001\u4ED8\u5148\u306E\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3082\u304A\u4F3A\u3044\u3067\u304D\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F`,
          "P8",
          fired,
          `${note} \u2192 \u9001\u4ED8\u5148\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3078\uFF08\u9332\u97F3\u306A\u3057\u30FB\u97F3\u58F0\u5408\u6210\uFF09`
        );
      }
      return this.advanceP8([note], fired, ack);
    }
    /** そのスロットがすでに埋まっているか。 */
    isFilled(slot) {
      switch (slot) {
        case "email":
          return Boolean(this.state.email);
        case "emailConfirm":
          return this.state.emailConfirmed;
        case "callbackPhone":
          return Boolean(this.state.callbackPhone);
        case "callbackWindow":
          return Boolean(this.state.callbackWindow);
        default:
          return Boolean(this.state.hearing[slot]);
      }
    }
    nextSlot() {
      const h = missingHearing(this.state)[0];
      if (h) return h;
      if (!this.state.email) return "email";
      if (!this.state.emailConfirmed) return "emailConfirm";
      if (!this.state.callbackPhone) return "callbackPhone";
      if (!this.state.callbackWindow) return "callbackWindow";
      return null;
    }
    askText(slot) {
      switch (slot) {
        case "email":
          return "\u8CC7\u6599\u3068\u30AA\u30F3\u30E9\u30A4\u30F3\u4F1A\u8B70\u306EURL\u3092\u304A\u9001\u308A\u3057\u305F\u3044\u306E\u3067\u3059\u304C\u3001\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3092\u4F3A\u3048\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F";
        case "emailConfirm":
          return `\u5FA9\u5531\u3055\u305B\u3066\u3044\u305F\u3060\u304D\u307E\u3059\u3002${this.state.email} \u3067\u304A\u9593\u9055\u3044\u306A\u3044\u3067\u3057\u3087\u3046\u304B\uFF1F`;
        case "callbackPhone":
          return "\u524D\u65E5\u306B\u78BA\u8A8D\u306E\u3054\u9023\u7D61\u3092\u5DEE\u3057\u4E0A\u3052\u305F\u3044\u306E\u3067\u3059\u304C\u3001\u304A\u96FB\u8A71\u756A\u53F7\u3092\u4F3A\u3048\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F";
        case "callbackWindow":
          return "\u524D\u65E5\u306E\u3054\u9023\u7D61\u306F\u3001\u4F55\u6642\u9803\u304C\u7E4B\u304C\u308A\u3084\u3059\u3044\u3067\u3057\u3087\u3046\u304B\uFF1F";
        default:
          return (HEARING_SLOT_MAP.get(slot)?.question ?? "").replace(/（[^）]*）\s*$/, "");
      }
    }
    /** 「今どの項目を聞いているか」が分かっているので、その文脈で回答を解釈する。 */
    extract(slot, text) {
      const num = COUNT_RE.exec(text)?.[1];
      const count = num ? toNumber(num) : null;
      switch (slot) {
        case "H1":
          return {
            facts: {
              H1: /(やって(い)?ませ|して(い)?ませ|入って(い)?ませ|やってな|してな|入ってな|ない|いない|特に|無し|なし|未加入|ありませ|ございませ)/.test(
                text
              ) ? "iDeCo\u30FB\u6295\u8CC7\u3068\u3082\u306B\u306A\u3057" : text
            },
            ok: true
          };
        case "H2":
          return { facts: { H2: text }, ok: true };
        case "H3": {
          const m = AGE_RE.exec(text);
          const age = m?.[1] ?? m?.[3];
          const era = AGE_ERA.exec(text)?.[1];
          if (age) return { facts: { H3: `${age}\u6B73` }, ok: true };
          if (era) return { facts: { H3: `${era}\u4EE3` }, ok: true };
          return { facts: { H3: text }, ok: false };
        }
        case "H4":
          return { facts: { H4: count !== null ? `${count}\u540D\uFF08${text}\uFF09` : text }, ok: count !== null };
        case "H5":
          return { facts: { H5: count !== null ? `${count}\u540D` : text }, ok: count !== null };
        case "H6":
          return {
            facts: {
              H6: /(私|自分|わたし|一人で|独断|即決|はい|そうです|決められ|決めて|決裁|判断でき)/.test(text) ? "\u4EE3\u8868\u306E\u5224\u65AD\u3067\u6C7A\u88C1\u53EF\u80FD" : text
            },
            ok: true
          };
        case "H7": {
          const m = MONTH_RE.exec(text);
          const month = m?.[1] ? toNumber(m[1]) : null;
          return { facts: { H7: month !== null ? `${month}\u6708` : text }, ok: month !== null };
        }
        case "email": {
          const m = EMAIL_RE.exec(text.replace(/\s/g, ""));
          return { facts: { email: m?.[0] ?? null }, ok: Boolean(m) };
        }
        case "emailConfirm":
          return { facts: { email_confirmed: true }, ok: YES.test(text) && !NO.test(text) };
        case "callbackPhone": {
          const m = PHONE_RE.exec(text.replace(/\s/g, ""));
          return { facts: { callback_phone: m?.[0] ?? null }, ok: Boolean(m) };
        }
        case "callbackWindow":
          return { facts: { callback_window: text }, ok: /(午前|午後|朝|昼|夕方|夜|時|いつでも)/.test(text) };
      }
    }
    // ---------- R7（不在）の継続 ----------
    /**
     * 不在と分かったあとの進行。
     *
     * 相手は取次ぎ担当で、制度の話をしても意味がない。
     * 「戻り時間」と「折り返し先」の2つが揃った時点で折り返しを約束して終話する。
     * どちらも取れないまま長引く場合は粘らずに終話する。
     */
    absentFollowUp(text, fired) {
      if (TRANSFER.test(text)) {
        this.absentMode = false;
        this.absentTurns = 0;
        return this.say("overview", this.toPhase("P1"), fired, "\u4E0D\u5728\u304B\u3089\u53D6\u6B21\u304E \u2192 \u6CD5\u6539\u6B63\u306E\u6982\u8981");
      }
      this.absentTurns++;
      if (!this.state.callbackWindow) {
        const window3 = RETURN_TIME.exec(text)?.[0];
        if (window3) applyExtracted(this.state, { callback_window: window3 });
      }
      const hasContact = Boolean(this.state.callbackPhone || this.state.email);
      const window2 = this.state.callbackWindow;
      if (window2 && hasContact) {
        return this.speakOnly(
          `\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\u3002\u305D\u308C\u3067\u306F${window2}\u9803\u306B\u6539\u3081\u3066\u304A\u96FB\u8A71\u3044\u305F\u3057\u307E\u3059\u3002\u304A\u5FD9\u3057\u3044\u3068\u3053\u308D\u5931\u793C\u3044\u305F\u3057\u307E\u3057\u305F\u3002`,
          this.toPhase("P0X"),
          fired,
          "\u4E0D\u5728: \u623B\u308A\u6642\u9593\u3068\u6298\u308A\u8FD4\u3057\u5148\u3092\u78BA\u4FDD \u2192 \u6298\u308A\u8FD4\u3057\u3092\u7D04\u675F\u3057\u3066\u7D42\u8A71"
        );
      }
      const askedWindow = this.absentAsked.has("window");
      const askedContact = this.absentAsked.has("contact");
      if (!window2 && !askedWindow) {
        this.absentAsked.add("window");
        return this.speakOnly(
          "\u6050\u308C\u5165\u308A\u307E\u3059\u3001\u4F55\u6642\u9803\u3067\u3057\u305F\u3089\u304A\u623B\u308A\u306B\u306A\u308A\u307E\u3059\u3067\u3057\u3087\u3046\u304B\u3002\u6539\u3081\u3066\u3053\u3061\u3089\u304B\u3089\u304A\u96FB\u8A71\u3044\u305F\u3057\u307E\u3059\u3002",
          this.state.phase,
          fired,
          "\u4E0D\u5728: \u623B\u308A\u6642\u9593\u306E\u78BA\u8A8D"
        );
      }
      if (!hasContact && !askedContact) {
        this.absentAsked.add("contact");
        this.expecting = "contact";
        return this.speakOnly(
          window2 ? `\u627F\u77E5\u3044\u305F\u3057\u307E\u3057\u305F\u3002${window2}\u9803\u306B\u6539\u3081\u3066\u304A\u96FB\u8A71\u3044\u305F\u3057\u307E\u3059\u3002\u5FF5\u306E\u305F\u3081\u3001\u3054\u62C5\u5F53\u8005\u69D8\u306E\u304A\u96FB\u8A71\u756A\u53F7\u304B\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3092\u4F3A\u3048\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F` : "\u6050\u308C\u5165\u308A\u307E\u3059\u3001\u3054\u62C5\u5F53\u8005\u69D8\u306E\u304A\u96FB\u8A71\u756A\u53F7\u304B\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3060\u3051\u4F3A\u3048\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F",
          this.state.phase,
          fired,
          "\u4E0D\u5728: \u6298\u308A\u8FD4\u3057\u5148\u306E\u78BA\u8A8D"
        );
      }
      return this.say("reject", this.toPhase("P0X"), fired, "\u4E0D\u5728: \u78BA\u8A8D\u304C\u53D6\u308C\u306A\u3044\u305F\u3081\u7C98\u3089\u305A\u7D42\u8A71");
    }
    // ---------- 受付ガード（担当者名の確認・取次ぎ先不明） ----------
    /**
     * 「担当者のお名前は分かりますか」「誰に繋げばいいですか」への切り返し。
     *
     * こちらは特定の個人名を持っていないので、名前で答えることはできない。
     * 部署（人事・総務・福利厚生）と役職（代表者）で取次ぎ先を示して、
     * 相手が動ける形にして返す。フェーズは進めない（まだ担当者に届いていないため）。
     */
    /** 受付ガードとして扱う場面か（ヒアリング中は質問への回答なので見ない）。 */
    isContactGuard(text) {
      const phase = this.state.phase;
      if (phase === "P8" || phase === "P9" || phase === "END" || phase === "P0X") return false;
      return isContactGuard(text);
    }
    handleContactUnknown(fired) {
      this.contactUnknownAsks++;
      this.unknownStreak = 0;
      if (this.contactUnknownAsks >= 2) {
        return this.say("reject", this.toPhase("P0X"), fired, "\u53D6\u6B21\u304E\u5148\u304C\u6C7A\u307E\u3089\u305A \u2192 \u7C98\u3089\u305A\u4E01\u5BE7\u306B\u7D42\u8A71");
      }
      return this.speakOnly(
        "\u6050\u308C\u5165\u308A\u307E\u3059\u3001\u7279\u5B9A\u306E\u500B\u4EBA\u540D\u3067\u306F\u306A\u304F\u3001\u73FE\u5728\u5FA1\u793E\u3067\u4EBA\u4E8B\u30FB\u7DCF\u52D9\u3084\u798F\u5229\u539A\u751F\u3092\u3054\u62C5\u5F53\u3055\u308C\u3066\u3044\u308B\u65B9\u3001\u3042\u308B\u3044\u306F\u4EE3\u8868\u8005\u69D8\u306B\u304A\u7E4B\u304E\u3044\u305F\u3060\u3051\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F",
        this.state.phase,
        fired,
        "\u62C5\u5F53\u8005\u540D\u306E\u78BA\u8A8D\u30FB\u53D6\u6B21\u304E\u5148\u4E0D\u660E \u2192 \u90E8\u7F72\u3068\u5F79\u8077\u3067\u53D6\u6B21\u304E\u5148\u3092\u793A\u3057\u3066\u518D\u4F9D\u983C"
      );
    }
    // ---------- 「ホームページを見て」への対応 ----------
    /** 「ホームページに載っている」型の回避かどうか。 */
    isHpReference(text) {
      const phase = this.state.phase;
      if (phase === "P8" || phase === "P9" || phase === "END" || phase === "P0X") return false;
      return HP_REFERENCE.test(text) || POSTED_ELSEWHERE.test(text);
    }
    /**
     * 「ホームページを見てください」と言われたときの切り返し。
     *
     * 送付先を聞き返すのは禁止（相手は送ってほしいと言っていない）。
     * 資料を送る理由が消えているので、受け止めたうえで直接オンラインでの接点に切り替える。
     * 2回続けて同じ回避をされたら食い下がらずに終話する。
     */
    handleHpReference(fired) {
      this.hpReferenced = true;
      this.hpDeflections++;
      this.unknownStreak = 0;
      if (this.hpDeflections >= 2 || this.refusalStreak >= 1) {
        return this.say("reject", this.toPhase("P0X"), fired, "2\u56DE\u7D9A\u3051\u3066HP\u53C2\u7167\u3067\u56DE\u907F \u2192 \u7C98\u3089\u305A\u4E01\u5BE7\u306B\u7D42\u8A71");
      }
      this.refusalStreak++;
      this.meetingOfferedAt = this.state.turns.length;
      return this.speakOnly(
        `\u627F\u77E5\u3044\u305F\u3057\u307E\u3057\u305F\uFF01\u3067\u306F\u5F0A\u793E\u306B\u3066\u30B5\u30A4\u30C8\u3088\u308A\u78BA\u8A8D\u3055\u305B\u3066\u3044\u305F\u3060\u304D\u307E\u3059\u306D\u3002\u5DEE\u3057\u652F\u3048\u306A\u3051\u308C\u3070\u3001${DEMO_SCENARIO.contactTitle}\u69D8\u3068\u4E00\u5EA6${DEMO_SCENARIO.meetingMinutes}\u5206\u307B\u3069\u30AA\u30F3\u30E9\u30A4\u30F3\u3067\u3054\u6328\u62F6\u3060\u3051\u3067\u3082\u304A\u6642\u9593\u3044\u305F\u3060\u3051\u306A\u3044\u3067\u3057\u3087\u3046\u304B\uFF1F`,
        this.toPhase("P7"),
        fired,
        "HP\u53C2\u7167 \u2192 \u9001\u4ED8\u5148\u306F\u805E\u304B\u305A\u3001\u30AA\u30F3\u30E9\u30A4\u30F3\u3067\u306E\u65E5\u7A0B\u6253\u8A3A\u306B\u5207\u308A\u66FF\u3048"
      );
    }
    // ---------- 断り・導入済みへの対応 ----------
    /**
     * 「もう対策してる」「間に合ってます」等の断りかどうか。
     *
     * 「大丈夫」は文脈で意味が反転する（日程の可否なら肯定、それ以外は「間に合っている」）。
     * ヒアリング中（P8 以降）は質問への回答なので断り判定しない。
     */
    isDecline(text) {
      const phase = this.state.phase;
      if (phase === "P8" || phase === "P9" || phase === "END" || phase === "P0X") return false;
      if (TRANSFER.test(text)) return false;
      if (phase === "P0" && /(営業|セールス|勧誘|売り込み)/.test(text) && REFUSE_SALES.test(text)) {
        return false;
      }
      if (DECLINE.test(text)) return true;
      if (/大丈夫/.test(text)) {
        const scheduling = phase === "P6" || phase === "P7" || this.justOfferedMeeting();
        return !scheduling && !SCHEDULE_CONTEXT.test(text);
      }
      return false;
    }
    /** 直前の AI 発話が、HP 参照の切り返し（オンラインでのご挨拶の打診）だったか。 */
    justOfferedMeeting() {
      for (let i = this.state.turns.length - 1; i >= 0; i--) {
        if (this.state.turns[i]?.speaker !== "agent") continue;
        return i === this.meetingOfferedAt;
      }
      return false;
    }
    /**
     * 断られたときの切り返し。
     * 1回目は「今やっているものとは別枠の制度」であることだけを伝え、
     * 2回続けて断られたら食い下がらずに終話する。
     */
    handleDecline(fired) {
      if (this.refusalStreak >= 2) {
        return this.say("reject", this.toPhase("P0X"), fired, "2\u56DE\u9023\u7D9A\u306E\u62D2\u7D76 \u2192 \u98DF\u3044\u4E0B\u304C\u3089\u305A\u4E01\u5BE7\u306B\u7D42\u8A71");
      }
      if (!this.said.has("r5OtherScheme")) {
        this.unknownStreak = 0;
        return this.say(
          "r5OtherScheme",
          this.state.phase,
          fired,
          "\u65AD\u308A\uFF08\u5BFE\u7B56\u6E08\u307F\u30FB\u9593\u306B\u5408\u3063\u3066\u3044\u308B\uFF09\u2192 \u4ECA\u3084\u3063\u3066\u3044\u308B\u3082\u306E\u3068\u306F\u5225\u67A0\u3067\u3042\u308B\u3053\u3068\u3092\u4F1D\u3048\u308B"
        );
      }
      return this.say("reject", this.toPhase("P0X"), fired, "\u65AD\u308A\u304C\u7D9A\u3044\u305F\u305F\u3081\u4E01\u5BE7\u306B\u7D42\u8A71");
    }
    // ---------- R2（多忙）の継続 ----------
    /**
     * R2 の切り返しを流したあとに、また「忙しい」と言われたときの処理。
     *
     * ここで別の話題（人数確認など）に引き延ばすと、断っている相手に話を被せる形になり
     * 文脈が破綻する。2回続けて断られた時点で食い下がるのをやめ、
     * 日を改める前提で丁寧に終話する（実データでも、粘った架電はすべて切られている）。
     *
     * 直後ではない再発火（会話が進んだあとの「忙しい」）は終話にせず、
     * 同じ切り返しの再生だけを避けて通常のフェーズ処理に渡す。
     */
    afterBusy(fired) {
      if (!this.justSaid(VOICE_LINES.r2Busy.text)) return null;
      return this.say(
        "reject",
        this.toPhase("P0X"),
        fired,
        "2\u56DE\u9023\u7D9A\u306E\u591A\u5FD9 \u2192 \u98DF\u3044\u4E0B\u304C\u3089\u305A\u65E5\u3092\u6539\u3081\u308B\u524D\u63D0\u3067\u4E01\u5BE7\u306B\u7D42\u8A71"
      );
    }
    /**
     * 謝罪から入る台本かどうか。
     * 「あ、失礼いたしました！」が続けて流れると、何に謝っているのか分からず不自然になるため、
     * 台本を選ぶ段階で連続を避ける（読み上げ側で文頭を削ると音声とテキストがずれるのでやらない）。
     */
    static opensWithApology(text) {
      return /^(あ、|ああ、)?(大変|誠に)?(失礼(いた)?しました|申し訳|すみません)/.test(text);
    }
    /** 直前の AI 発話が謝罪から入っていたか。 */
    justApologized() {
      const last = [...this.state.turns].reverse().find((t) => t.speaker === "agent");
      return last ? _DialogEngine.opensWithApology(last.text) : false;
    }
    /**
     * 言い直しの基準にする台本。
     *
     * 「実際に最後に流した質問」を使う。フェーズの主質問を使うと、切り返しで
     * フェーズが進んでいない場面で冒頭の挨拶まで巻き戻ってしまうため。
     * 挨拶は、まだ挨拶しかしていないときだけ言い直しの対象にする。
     */
    repairAnchor() {
      const last = this.lastLine;
      const spoken = this.state.turns.filter((t) => t.speaker === "agent").length;
      const onlyGreeted = spoken <= 1;
      if (last && !CLOSING_LINES.has(last) && (last !== "greeting" || onlyGreeted)) return last;
      const phaseAnchor = PHASE_ANCHOR[this.state.phase];
      if (phaseAnchor === "greeting" && !onlyGreeted) return void 0;
      return phaseAnchor;
    }
    /** 直前の AI 発話が同じ内容だったか（同じセリフを続けて流さないための判定）。 */
    justSaid(text) {
      for (let i = this.state.turns.length - 1; i >= 0; i--) {
        const turn = this.state.turns[i];
        if (turn?.speaker !== "agent") continue;
        return turn.text === text;
      }
      return false;
    }
    /** 遷移が許可されていないフェーズは提案しない（不要な却下フラグを出さないため）。 */
    toPhase(desired) {
      const current = this.state.phase;
      if (desired === current) return current;
      return PHASES[current].allowedNext.includes(desired) ? desired : current;
    }
    // ---------- 想定外の発話への立て直し ----------
    /**
     * どの分岐にも当たらなかったときの処理。
     *
     * ここで無条件に読み上げへ落とすと、収録音声と合成音声が交互に出て会話が壊れる。
     * そのため「言い直す → 最小の質問に切り替える → 日程に振る → 丁寧に終話」の順で、
     * 収録済みの台本を使いながら会話を前に進める。
     */
    repair(fired, reason) {
      this.unknownStreak++;
      const anchor = this.repairAnchor();
      if (this.unknownStreak === 1 && anchor && !this.replayed.has(anchor)) {
        this.replayed.add(anchor);
        if (!this.justSaid(VOICE_LINES[anchor].text)) {
          return this.say(anchor, this.state.phase, fired, `${reason} \u2192 \u76F4\u524D\u306E\u8CEA\u554F\u3092\u8A00\u3044\u76F4\u3059`, {
            replay: true
          });
        }
        const recap = this.recapReply(
          anchor,
          this.state.phase,
          fired,
          `${reason} \u2192 \u76F4\u524D\u306E\u8CEA\u554F\u3092\u77ED\u304F\u805E\u304D\u76F4\u3059`
        );
        if (recap) return recap;
      }
      if (!this.said.has("overview")) {
        return this.say("overview", this.toPhase("P1"), fired, `${reason} \u2192 \u6982\u8981\u304B\u3089\u4ED5\u5207\u308A\u76F4\u3059`);
      }
      if (!this.said.has("r1NoSystem") && !this.justApologized()) {
        this.expecting = "headcount";
        return this.say("r1NoSystem", this.state.phase, fired, `${reason} \u2192 \u6700\u5C0F\u306E\u8CEA\u554F\uFF08\u4EBA\u6570\uFF09\u306B\u5207\u308A\u66FF\u3048`);
      }
      if (!this.said.has("schedule")) {
        return this.say("schedule", this.toPhase("P7"), fired, `${reason} \u2192 \u5185\u5BB9\u3092\u96E2\u308C\u3066\u65E5\u7A0B\u6253\u8A3A\u306B\u5207\u308A\u66FF\u3048`);
      }
      return this.say("reject", "P0X", fired, `${reason} \u2192 \u7ACB\u3066\u76F4\u305B\u305A\u4E01\u5BE7\u306B\u7D42\u8A71`);
    }
    // ---------- 応答の確定（フィルタ・遷移検証・履歴） ----------
    /** 収録台本を1本読み上げる。画面表示テキストと音声は同じ定義から取る。 */
    say(id, proposed, fired, matched, opts = {}) {
      const line = VOICE_LINES[id];
      const alreadySaid = this.said.has(id);
      this.said.add(id);
      this.lastLine = id;
      const audioFile = !alreadySaid || opts.replay ? audioUrl(line.file) : void 0;
      return this.emit(line.text, proposed, fired, matched, audioFile);
    }
    /**
     * 切り返しを流す。すでに同じ台本を流していれば、同じ文言を繰り返さず要点だけ聞き直す。
     * 同じ切り返しが何度も流れると会話が進まなくなるため。
     */
    guardrailReply(id, proposed, fired, matched) {
      if (!this.said.has(id)) return this.say(id, proposed, fired, matched);
      return this.recapReply(id, proposed, fired, `${matched}\uFF08\u518D\u63B2\u306E\u305F\u3081\u8981\u70B9\u306E\u307F\uFF09`);
    }
    /**
     * 台本の要点だけを一言で聞き直す。
     * 1つの台本につき1回まで。直前と同じ文言になる場合は出さない（言えることが尽きたら次へ進める）。
     */
    recapReply(id, proposed, fired, matched) {
      const recap = RECAP[id];
      if (!recap || this.recapped.has(id) || this.justSaid(recap)) return null;
      this.recapped.add(id);
      return this.speakOnly(recap, proposed, fired, matched);
    }
    /** 収録の無い発話（P8 の個別質問など）。音声合成で読み上げる。 */
    speakOnly(raw, proposed, fired, matched) {
      this.lastLine = null;
      return this.emit(raw, proposed, fired, matched, void 0);
    }
    emit(raw, proposed, fired, matched, audioFile) {
      const fixed = autoFix(raw);
      const blocked = checkForbidden(raw).filter((v) => v.fixable);
      const utterance = fixed.text;
      applyExtracted(this.state, {
        calendar_requested: /カレンダー/.test(utterance),
        law_change_hook_used: /(法改正|62,?000円)/.test(utterance)
      });
      const forbidEnd = Object.keys(GUARDRAILS).filter((id) => GUARDRAILS[id].forbidEnd);
      const t = resolveTransition(this.state, proposed, fired, forbidEnd);
      this.state.turns.push({
        index: this.state.turns.length,
        speaker: "agent",
        text: utterance,
        phase: this.state.phase,
        blockedViolations: blocked.length > 0 ? blocked : void 0,
        note: matched
      });
      this.state.blockedViolationCount += blocked.length;
      this.state.phase = t.phase;
      if (t.phase === "END" || t.phase === "P0X") this.state.ended = true;
      return {
        utterance,
        phase: t.phase,
        guardrails: fired,
        matched,
        overrideReason: t.overrideReason,
        blocked,
        audioFile
      };
    }
    /** 相手の発話を履歴に積む（画面側から呼ぶ）。 */
    pushCustomer(text, guardrails) {
      this.state.turns.push({
        index: this.state.turns.length,
        speaker: "customer",
        text,
        phase: this.state.phase,
        guardrails
      });
    }
  };

  // src/demo/transferEngine.ts
  var HANDOVER_PATTERNS = [
    // 保留・取次ぎの合図
    /(少々|少し|しばらく|ちょっと)[^。]{0,4}お待ち/,
    /お待ちください/,
    /(お|御)?(繋ぎ|つなぎ)(し|いた|ます|します)/,
    /(繋|つな)ぎます/,
    /(代わ|かわ|替わ)(り|ります|りました|ります)/,
    /(呼んで|お呼びして)(まいり|参り|きます|まいります)/,
    /確認して(まいり|参り|きます|みます)/,
    /(ただいま|只今)[^。]{0,6}(代わ|お繋ぎ|つなぎ)/,
    // 本人・担当者が出た合図（タイプA と同じ判定を使う）
    SELF_IDENTIFIED,
    /(担当|責任者|窓口|代表|社長)の[^\s、。]{1,8}?(です|でございます)/,
    /(担当|責任者|代表|社長)(の者)?(です|でございます)/,
    /お電話代わりました/
  ];
  var PURPOSE_FOLLOWUP = /(具体的|内容|詳し|中身|どんな話|なんの話|何の話|要する|どういうこと)/;
  function detectHandover(text) {
    return HANDOVER_PATTERNS.some((p) => p.test(text));
  }
  function detectAbsence(text) {
    return detectGuardrails(text).includes("R7") && ABSENT_NOW.test(text);
  }
  var TransferEngine = class {
    /** 用件説明をすでに1回行ったか。 */
    purposeExplained = false;
    /** 取次ぎ依頼を言い直した回数。 */
    retries = 0;
    /** 用件を問われた回数。 */
    purposeAsks = 0;
    /** 具体的な部署・役職を提示済みか。 */
    departmentSuggested = false;
    outcome = "calling";
    absence = null;
    /** 通話が終わっている（引き継ぎ済み・終話済み）か。 */
    get finished() {
      return this.outcome !== "calling";
    }
    get result() {
      return this.outcome;
    }
    /** 不在だった場合の記録。 */
    get absenceRecord() {
      return this.absence;
    }
    /** 架電開始の第一声（取次ぎ依頼）。 */
    greeting() {
      return this.say("greeting", "\u67B6\u96FB\u958B\u59CB \u2192 \u62C5\u5F53\u8005\u3078\u306E\u53D6\u6B21\u304E\u4F9D\u983C");
    }
    respond(customerText) {
      const text = customerText.trim();
      const fired = detectGuardrails(text);
      if (REFUSE_SALES.test(text)) {
        this.outcome = "rejected";
        return this.say("reject", "\u55B6\u696D\u304A\u65AD\u308A \u2192 \u5F15\u304D\u5EF6\u3070\u3055\u305A\u7D42\u8A71", fired);
      }
      if (detectAbsence(text)) {
        this.outcome = "absent";
        this.absence = { said: text, returnTime: RETURN_TIME.exec(text)?.[0] ?? null };
        return this.say("reject", "\u4E0D\u5728 \u2192 \u4E0D\u5728\u8A18\u9332\u3092\u6B8B\u3057\u3066\u7D42\u8A71", fired);
      }
      if (detectHandover(text)) {
        this.outcome = "handover";
        return {
          utterance: "",
          matched: "\u62C5\u5F53\u8005\u63A5\u7D9A\u3092\u691C\u77E5 \u2192 \u30AA\u30DA\u30EC\u30FC\u30BF\u30FC\u3078\u5F15\u304D\u7D99\u304E\uFF08AI \u306E\u767A\u8A71\u3092\u505C\u6B62\uFF09",
          outcome: "handover",
          handover: true,
          guardrails: fired,
          blocked: []
        };
      }
      if (isContactGuard(text)) {
        if (!this.departmentSuggested) {
          this.departmentSuggested = true;
          return isContactNameAsked(text) ? this.speak(
            "\u5931\u793C\u3044\u305F\u3057\u307E\u3057\u305F\uFF01\u7279\u5B9A\u306E\u304A\u540D\u524D\u3067\u306F\u306A\u304F\u3001\u4EBA\u4E8B\u30FB\u7DCF\u52D9\u306E\u3054\u62C5\u5F53\u8005\u69D8\u304B\u4EE3\u8868\u8005\u69D8\u306B\u304A\u7E4B\u304E\u3044\u305F\u3060\u3051\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F",
            "\u62C5\u5F53\u8005\u540D\u306E\u78BA\u8A8D \u2192 \u90E8\u7F72\u30FB\u5F79\u8077\u3092\u6307\u5B9A\u3057\u3066\u53D6\u6B21\u304E\u3092\u518D\u4F9D\u983C",
            fired
          ) : this.speak(
            "\u5931\u793C\u3044\u305F\u3057\u307E\u3057\u305F\uFF01\u7DCF\u52D9\u3084\u4EBA\u4E8B\u306E\u3054\u62C5\u5F53\u8005\u69D8\u3001\u3042\u308B\u3044\u306F\u4EE3\u8868\u8005\u69D8\uFF08\u793E\u9577\u69D8\uFF09\u306B\u304A\u7E4B\u304E\u3044\u305F\u3060\u3051\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F",
            "\u62C5\u5F53\u4E0D\u660E \u2192 \u7DCF\u52D9\u30FB\u4EBA\u4E8B\u30FB\u4EE3\u8868\u8005\u3092\u6319\u3052\u3066\u53D6\u6B21\u304E\u3092\u518D\u4F9D\u983C",
            fired
          );
        }
        this.outcome = "rejected";
        return this.say("reject", "\u53D6\u6B21\u304E\u5148\u304C\u6C7A\u307E\u3089\u305A \u2192 \u7C98\u3089\u305A\u7D42\u8A71", fired);
      }
      if (ASK_PURPOSE.test(text) || PURPOSE_FOLLOWUP.test(text)) {
        this.purposeAsks++;
        if (this.purposeAsks === 1) {
          this.purposeExplained = true;
          return this.say("overview", "\u7528\u4EF6\u3092\u554F\u308F\u308C\u305F \u2192 \u6CD5\u6539\u6B63\u306E\u4EF6\u3068\u3057\u30661\u56DE\u3060\u3051\u8AAC\u660E", fired);
        }
        if (this.purposeAsks === 2) {
          return this.speak(
            "\u306F\u3044\u3001\u5FA1\u793E\u306E\u73FE\u5728\u306E\u5236\u5EA6\u5C0E\u5165\u72B6\u6CC1\u306B\u3064\u3044\u3066\u306E\u7C21\u5358\u306A\u78BA\u8A8D\u3067\u3054\u3056\u3044\u307E\u3059\u3002\u6050\u308C\u5165\u308A\u307E\u3059\u304C\u3001\u3054\u62C5\u5F53\u8005\u69D8\u306B\u304A\u7E4B\u304E\u3044\u305F\u3060\u3051\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F",
            "\u7528\u4EF6\u3092\u91CD\u306D\u3066\u554F\u308F\u308C\u305F \u2192 \u5185\u5BB9\u3092\u4E00\u8A00\u3067\u793A\u3057\u3066\u53D6\u6B21\u304E\u3092\u518D\u4F9D\u983C",
            fired
          );
        }
        this.outcome = "rejected";
        return this.say("reject", "\u7528\u4EF6\u8AAC\u660E\u3092\u91CD\u306D\u3066\u3082\u53D6\u6B21\u304E\u306B\u81F3\u3089\u305A \u2192 \u7C98\u3089\u305A\u7D42\u8A71", fired);
      }
      this.retries++;
      if (this.retries >= 2) {
        this.outcome = "rejected";
        return this.say("reject", "\u53D6\u6B21\u304E\u306B\u81F3\u3089\u305A \u2192 \u7C98\u3089\u305A\u7D42\u8A71", fired);
      }
      return this.say("greeting", "\u53D6\u6B21\u304E\u306B\u81F3\u3089\u305A \u2192 \u4F9D\u983C\u3092\u8A00\u3044\u76F4\u3059", fired);
    }
    /** 収録の無い応答（具体的な部署の提示など）。音声合成で読み上げる。 */
    speak(raw, matched, fired = []) {
      return {
        utterance: autoFix(raw).text,
        matched,
        outcome: this.outcome,
        handover: false,
        guardrails: fired,
        blocked: checkForbidden(raw).filter((v) => v.fixable)
      };
    }
    say(id, matched, fired = []) {
      const line = VOICE_LINES[id];
      const utterance = autoFix(line.text).text;
      const blocked = checkForbidden(line.text).filter((v) => v.fixable);
      return {
        utterance,
        audioFile: audioUrl(line.file),
        matched,
        outcome: this.outcome,
        handover: false,
        guardrails: fired,
        blocked
      };
    }
  };

  // src/web/main.ts
  var $ = (id) => {
    const el2 = document.getElementById(id);
    if (!el2) throw new Error(`#${id} \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093`);
    return el2;
  };
  var state = createCallState();
  var dialog = new DialogEngine(state);
  var transfer = new TransferEngine();
  var mic = new MicInput();
  var mode = "appointment";
  var callStarted = false;
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== void 0) node.textContent = text;
    return node;
  }
  function renderScenario() {
    const s = DEMO_SCENARIO;
    const goal = mode === "transfer" ? "\u30B4\u30FC\u30EB: \u53D7\u4ED8\u3092\u7A81\u7834\u3057\u3066\u62C5\u5F53\u8005\u306B\u53D6\u6B21\u3044\u3067\u3082\u3089\u3044\u3001\u4EBA\u9593\u306E\u30AA\u30DA\u30EC\u30FC\u30BF\u30FC\u3078\u5F15\u304D\u7D99\u3050" : `\u30B4\u30FC\u30EB: ${s.proposedDate} ${s.proposedTime} \u306E Zoom \u5546\u8AC7\uFF08${s.meetingMinutes}\u5206\uFF09\u78BA\u5B9A\uFF0B\u30D2\u30A2\u30EA\u30F3\u30B07\u9805\u76EE\u53D6\u5F97`;
    $("scenario").textContent = `\u67B6\u96FB\u5148: ${s.companyName}\uFF08\u5F93\u696D\u54E1${s.employeeCount}\u540D\u30FB\u5F79\u54E1${s.officerCount}\u540D\uFF09 \uFF0F \u76F8\u624B: ${s.contactTitle} ${s.contactName}\u69D8 \uFF0F ${goal}`;
  }
  function renderSteps() {
    const list = $("steps");
    list.innerHTML = "";
    const currentIdx = PHASE_ORDER.indexOf(state.phase);
    for (const id of PHASE_ORDER) {
      const p = PHASES[id];
      const idx = PHASE_ORDER.indexOf(id);
      const done = state.ended || currentIdx >= 0 && idx < currentIdx;
      const now = id === state.phase;
      const li = el("li", now ? "now" : done ? "done" : "");
      li.append(el("span", "id", p.id), el("span", "", p.label));
      list.append(li);
    }
  }
  function renderHearing() {
    const list = $("hearing");
    list.innerHTML = "";
    for (const s of HEARING_SLOTS) {
      const v = state.hearing[s.id];
      const li = el("li", v ? "ok" : "ng");
      li.append(el("span", "mark", v ? "\u25CB" : "\xD7"));
      const body = el("span");
      body.append(document.createTextNode(`${s.id} ${s.label}`));
      if (s.critical) body.append(el("span", "crit", " \u26A0\u5FC5\u9808"));
      body.append(el("span", "detail", v ?? "\u672A\u53D6\u5F97"));
      li.append(body);
      list.append(li);
    }
    const extras = [
      ["\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\uFF08\u5FA9\u5531\u78BA\u8A8D\uFF09", state.email && state.emailConfirmed ? `${state.email}\uFF08\u5FA9\u5531\u6E08\uFF09` : null],
      ["\u524D\u65E5\u78BA\u8A8D\u306E\u9023\u7D61\u5148", state.callbackPhone],
      ["\u524D\u65E5\u9023\u7D61\u306E\u5E0C\u671B\u6642\u9593\u5E2F", state.callbackWindow]
    ];
    for (const [label, v] of extras) {
      const li = el("li", v ? "ok" : "ng");
      li.append(el("span", "mark", v ? "\u25CB" : "\xD7"));
      const body = el("span");
      body.append(document.createTextNode(label), el("span", "detail", v ?? "\u672A\u53D6\u5F97"));
      li.append(body);
      list.append(li);
    }
  }
  function renderDod() {
    const dod = evaluateDod(state);
    const list = $("dod");
    list.innerHTML = "";
    for (const i of dod.items) {
      const li = el("li", i.ok ? "ok" : "ng");
      li.append(el("span", "mark", i.ok ? "\u25CB" : "\xD7"));
      const body = el("span");
      body.append(document.createTextNode(i.label), el("span", "detail", i.detail));
      li.append(body);
      list.append(li);
    }
    const v = $("verdict");
    v.className = `verdict ${dod.passed ? "pass" : "fail"}`;
    v.textContent = dod.passed ? "\u2705 \u30A2\u30DD\u6210\u7ACB\uFF08\u5168\u9805\u76EE\u25CB\uFF09" : "\u672A\u6210\u7ACB\uFF08\u672A\u5145\u8DB3\u3042\u308A\uFF09";
    const tbody = $("baseline");
    tbody.innerHTML = "";
    for (const b of dod.humanBaseline) {
      const tr = el("tr");
      tr.append(el("td", "", b.label));
      tr.append(el("td", "n hu", `${Math.round(b.human * 100)}%`));
      tr.append(el("td", "n ai", b.ai === 1 ? "100%" : "\u2014"));
      tbody.append(tr);
    }
  }
  function renderGuardrails() {
    const box = $("guardrails");
    box.innerHTML = "";
    if (state.firedGuardrails.length === 0) {
      box.append(el("div", "note", "\u767A\u706B\u306A\u3057"));
    } else {
      for (const id of state.firedGuardrails) {
        const tag = el("span", "tag", `${id} ${GUARDRAILS[id].trigger}`);
        box.append(tag);
      }
    }
    $("compliance").textContent = `\u76F8\u624B\u306B\u5C4A\u3044\u305F\u7981\u6B62\u8868\u73FE: 0 \u4EF6\uFF08\u51FA\u529B\u524D\u30D5\u30A3\u30EB\u30BF\u3067\u767A\u8A71\u524D\u306B\u906E\u65AD ${state.blockedViolationCount} \u4EF6\uFF09\u3002\u767A\u8A71\u306F\u53CE\u9332\u6E08\u307F\u306E\u53F0\u672C\u3067\u3001\u751F\u6210\u524D\u5236\u7D04\u304C\u52B9\u3044\u3066\u3044\u308B\u72B6\u614B\u3067\u3059\u3002`;
  }
  function renderAll() {
    renderSteps();
    renderHearing();
    renderDod();
    renderGuardrails();
    renderTransfer();
    syncButtons();
  }
  function renderTransfer() {
    const list = $("transferStatus");
    list.innerHTML = "";
    const outcome = transfer.result;
    const rows = [
      [
        "\u53D6\u6B21\u304E\u72B6\u6CC1",
        outcome === "handover",
        outcome === "handover" ? "\u62C5\u5F53\u8005\u63A5\u7D9A\u3092\u691C\u77E5\uFF08\u30AA\u30DA\u30EC\u30FC\u30BF\u30FC\u3078\u5F15\u304D\u7D99\u304E\uFF09" : outcome === "absent" ? "\u4E0D\u5728\u306E\u305F\u3081\u7D42\u8A71" : outcome === "rejected" ? "\u53D6\u6B21\u304E\u306B\u81F3\u3089\u305A\u7D42\u8A71" : callStarted ? "\u67B6\u96FB\u4E2D" : "\u672A\u67B6\u96FB"
      ],
      [
        "\u4E0D\u5728\u8A18\u9332",
        Boolean(transfer.absenceRecord),
        transfer.absenceRecord ? `${transfer.absenceRecord.said}${transfer.absenceRecord.returnTime ? `\uFF08\u623B\u308A: ${transfer.absenceRecord.returnTime}\uFF09` : ""}` : "\u306A\u3057"
      ]
    ];
    for (const [label, ok, detail] of rows) {
      const li = el("li", ok ? "ok" : "ng");
      li.append(el("span", "mark", ok ? "\u25CB" : "\u2014"));
      const body = el("span");
      body.append(document.createTextNode(label), el("span", "detail", detail));
      li.append(body);
      list.append(li);
    }
  }
  var transcript = () => $("transcript");
  function clearTranscript() {
    transcript().innerHTML = '<div class="empty">\u300C\u901A\u8A71\u958B\u59CB\u300D\u3067\u67B6\u96FB\u3092\u59CB\u3081\u307E\u3059</div>';
  }
  function pushPhaseSeparator(phase) {
    const p = PHASES[phase];
    const sep = el("div", "phase-sep");
    sep.append(el("b", "", `${p.id} ${p.label}`), el("span", "", p.goal));
    transcript().append(sep);
  }
  function pushMessage(kind, who, text) {
    const row = el("div", `msg ${kind}`);
    row.append(el("div", "who", who), el("div", "bubble", text));
    transcript().append(row);
    return row;
  }
  function pushFlag(text) {
    const d = el("div", "flag", text);
    transcript().append(d);
  }
  var follow = true;
  function nearBottom() {
    const doc = document.documentElement;
    return window.innerHeight + window.scrollY >= doc.scrollHeight - 140;
  }
  function setFollow(on) {
    follow = on;
    $("follow").hidden = on;
  }
  function scrollToActive(node) {
    if (!follow) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  window.addEventListener("wheel", (e) => {
    if (e.deltaY < 0) setFollow(false);
  }, { passive: true });
  window.addEventListener("touchmove", () => {
    if (!nearBottom()) setFollow(false);
  }, { passive: true });
  window.addEventListener("keydown", (e) => {
    if (["ArrowUp", "PageUp", "Home"].includes(e.key)) setFollow(false);
  });
  window.addEventListener("scroll", () => {
    if (!follow && nearBottom()) setFollow(true);
  }, { passive: true });
  var voiceOn = () => $("voice").checked;
  var voices = [];
  async function initVoices() {
    const sel = $("voicesel");
    if (!("speechSynthesis" in window)) {
      sel.disabled = true;
      sel.innerHTML = "<option>\u97F3\u58F0\u975E\u5BFE\u5FDC\u306E\u30D6\u30E9\u30A6\u30B6\u3067\u3059</option>";
      return;
    }
    voices = await japaneseVoices();
    sel.innerHTML = "";
    if (voices.length === 0) {
      sel.disabled = true;
      sel.innerHTML = "<option>\u65E5\u672C\u8A9E\u30DC\u30A4\u30B9\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093</option>";
      return;
    }
    voices.forEach((v, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = i === 0 ? `${v.name}\uFF08\u63A8\u5968\uFF09` : v.name;
      sel.append(o);
    });
    sel.value = "0";
  }
  var selectedVoice = () => voices[Number($("voicesel").value || 0)] ?? null;
  function speak(text) {
    if (!voiceOn()) return Promise.resolve();
    return speakUtterance(text, { voice: selectedVoice(), rate: 1, gapMs: 240 });
  }
  async function speakReply(text, audioFile) {
    if (!voiceOn()) return;
    if (audioFile && await playAudioFile(audioFile)) return;
    await speak(text);
  }
  function stopVoice() {
    window.speechSynthesis?.cancel();
    stopAudio();
  }
  var pause = (ms) => new Promise((r) => window.setTimeout(r, ms));
  var lastPhase = null;
  function setMicNote(text, isError = false) {
    const n = $("micnote");
    n.textContent = text;
    n.className = `micnote${isError ? " err" : ""}`;
  }
  var interimNode = null;
  function showInterim(text) {
    if (!interimNode) {
      if (transcript().querySelector(".empty")) transcript().innerHTML = "";
      interimNode = pushMessage("cust", "\u76F8\u624B", text);
      interimNode.classList.add("interim");
    } else {
      const bubble = interimNode.querySelector(".bubble");
      if (bubble) bubble.textContent = text;
    }
    scrollToActive(interimNode);
  }
  function clearInterim() {
    interimNode?.remove();
    interimNode = null;
  }
  async function handleCustomerUtterance(text) {
    if (mode === "transfer") return handleTransferUtterance(text);
    if (busy || state.ended) return;
    busy = true;
    syncButtons();
    try {
      if (transcript().querySelector(".empty")) transcript().innerHTML = "";
      const guardrails = detectGuardrails(text);
      dialog.pushCustomer(text, guardrails);
      const custNode = pushMessage("cust", "\u76F8\u624B", text);
      if (guardrails.length > 0) {
        pushFlag(
          `\u30AC\u30FC\u30C9\u30EC\u30FC\u30EB\u691C\u77E5: ${guardrails.map((g) => `${g}\uFF08${GUARDRAILS[g].trigger}\uFF09`).join(" / ")}`
        );
      }
      scrollToActive(custNode);
      await pause(200);
      const r = dialog.respond(text);
      if (r.overrideReason) pushFlag(`\u26A0 \u9077\u79FB\u3092\u5374\u4E0B: ${r.overrideReason}`);
      if (r.blocked.length > 0) {
        pushFlag(
          `\u51FA\u529B\u524D\u30D5\u30A3\u30EB\u30BF: ${r.blocked.map((v) => `\u300C${v.matched}\u300D(${v.ruleId})`).join(", ")} \u3092\u76F8\u624B\u306B\u5C4A\u304F\u524D\u306B\u906E\u65AD`
        );
      }
      if (r.phase !== lastPhase) {
        pushPhaseSeparator(r.phase);
        lastPhase = r.phase;
      }
      const node = pushMessage("ai", "AI", r.utterance);
      const source = r.audioFile ? `\u9332\u97F3 ${r.audioFile.split("/").pop()}` : "\u97F3\u58F0\u5408\u6210";
      const why = el("div", "flag", `\u5224\u5B9A: ${r.matched} \uFF0F \u97F3\u6E90: ${source}`);
      transcript().append(why);
      node.classList.add("speaking");
      renderAll();
      scrollToActive(node);
      await speakReply(r.utterance, r.audioFile);
      node.classList.remove("speaking");
      renderAll();
    } finally {
      busy = false;
      syncButtons();
    }
  }
  async function handleTransferUtterance(text) {
    if (busy || transfer.finished) return;
    busy = true;
    syncButtons();
    try {
      if (transcript().querySelector(".empty")) transcript().innerHTML = "";
      const custNode = pushMessage("cust", "\u76F8\u624B", text);
      scrollToActive(custNode);
      const r = transfer.respond(text);
      if (r.guardrails.length > 0) {
        for (const g of r.guardrails) {
          if (!state.firedGuardrails.includes(g)) state.firedGuardrails.push(g);
        }
        pushFlag(
          `\u30AC\u30FC\u30C9\u30EC\u30FC\u30EB\u691C\u77E5: ${r.guardrails.map((g) => `${g}\uFF08${GUARDRAILS[g].trigger}\uFF09`).join(" / ")}`
        );
      }
      if (r.handover) {
        stopVoice();
        mic.abort();
        pushFlag(`\u5224\u5B9A: ${r.matched}`);
        showHandover(true);
        renderAll();
        return;
      }
      pushFlag(`\u5224\u5B9A: ${r.matched}`);
      const node = pushMessage("ai", "AI", r.utterance);
      node.classList.add("speaking");
      renderAll();
      scrollToActive(node);
      await speakReply(r.utterance, r.audioFile);
      node.classList.remove("speaking");
      renderAll();
    } finally {
      busy = false;
      syncButtons();
    }
  }
  function toggleMic() {
    const btn = $("mic");
    if (mic.listening) {
      mic.stop();
      return;
    }
    stopVoice();
    setMicNote("\u304A\u8A71\u3057\u304F\u3060\u3055\u3044\u2026");
    btn.classList.add("on");
    btn.textContent = "\u25A0 \u8A71\u3057\u7D42\u308F\u308A";
    mic.start({
      onInterim: showInterim,
      onFinal: (text) => {
        clearInterim();
        setMicNote("");
        void handleCustomerUtterance(text);
      },
      onError: (msg) => {
        clearInterim();
        setMicNote(msg, true);
      },
      onEnd: () => {
        btn.classList.remove("on");
        btn.textContent = "\u{1F3A4} \u8A71\u3059";
        clearInterim();
      }
    });
  }
  function applyPanels() {
    const transferMode = mode === "transfer";
    $("transferPanel").hidden = !transferMode;
    for (const id of ["stepsPanel", "hearingPanel", "dodPanel", "baselinePanel"]) {
      $(id).hidden = transferMode;
    }
    $("modeA").classList.toggle("on", !transferMode);
    $("modeB").classList.toggle("on", transferMode);
  }
  function showHandover(on) {
    $("handover").hidden = !on;
    if (on) $("handover").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function setMode(next) {
    if (mode === next) return;
    mode = next;
    applyPanels();
    renderScenario();
    reset();
  }
  function applySetup() {
    mic.abort();
    applyPanels();
    setMicNote(
      micSupported() ? "\u300C\u{1F4DE} \u901A\u8A71\u958B\u59CB\u300D\u3092\u62BC\u3059\u3068\u67B6\u96FB\u304C\u59CB\u307E\u308A\u307E\u3059\u3002\u4EE5\u964D\u306F\u300C\u{1F3A4} \u8A71\u3059\u300D\u3067\u8A71\u3057\u304B\u3051\u3066\u304F\u3060\u3055\u3044\u3002" : "\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306F\u97F3\u58F0\u8A8D\u8B58\u306B\u5BFE\u5FDC\u3057\u3066\u3044\u307E\u305B\u3093\uFF08Chrome / Edge / Safari \u3092\u304A\u4F7F\u3044\u304F\u3060\u3055\u3044\uFF09\u3002",
      !micSupported()
    );
    syncButtons();
  }
  async function startCall() {
    busy = true;
    callStarted = true;
    syncButtons();
    try {
      if (transcript().querySelector(".empty")) transcript().innerHTML = "";
      const r = mode === "transfer" ? transfer.greeting() : dialog.greeting();
      if ("phase" in r) {
        pushPhaseSeparator(r.phase);
        lastPhase = r.phase;
      }
      const node = pushMessage("ai", "AI", r.utterance);
      node.classList.add("speaking");
      renderAll();
      scrollToActive(node);
      await speakReply(r.utterance, r.audioFile);
      node.classList.remove("speaking");
      setMicNote("\u300C\u{1F3A4} \u8A71\u3059\u300D\u3092\u62BC\u3057\u3066\u8A71\u3057\u304B\u3051\u3066\u304F\u3060\u3055\u3044\u3002");
    } finally {
      busy = false;
      syncButtons();
    }
  }
  var busy = false;
  function syncButtons() {
    const btn = $("mic");
    const ended = mode === "transfer" ? transfer.finished : state.ended;
    btn.disabled = ended || busy || !micSupported();
    if (!callStarted) btn.textContent = "\u{1F4DE} \u901A\u8A71\u958B\u59CB";
    else if (!mic.listening) btn.textContent = "\u{1F3A4} \u8A71\u3059";
  }
  function reset() {
    stopVoice();
    busy = false;
    callStarted = false;
    mic.abort();
    clearInterim();
    showHandover(false);
    state = createCallState();
    dialog = new DialogEngine(state);
    transfer = new TransferEngine();
    lastPhase = null;
    clearTranscript();
    setFollow(true);
    renderAll();
    applySetup();
    window.scrollTo({ top: 0 });
  }
  renderScenario();
  renderAll();
  $("mic").addEventListener("click", () => {
    if (!callStarted) {
      void startCall();
      return;
    }
    toggleMic();
  });
  $("reset").addEventListener("click", reset);
  $("follow").addEventListener("click", () => {
    setFollow(true);
    transcript().lastElementChild?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  $("voice").addEventListener("change", () => {
    if (!voiceOn()) stopVoice();
  });
  $("modeA").addEventListener("click", () => setMode("appointment"));
  $("modeB").addEventListener("click", () => setMode("transfer"));
  applySetup();
  void initVoices();
})();
