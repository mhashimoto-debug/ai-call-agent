"use strict";
(() => {
  // src/domain/phases.ts
  var PHASES = {
    P0: {
      id: "P0",
      label: "\u53D7\u4ED8\u7A81\u7834",
      goal: "30\u79D2\u4EE5\u5185\u306B\u4EE3\u8868\u3078\u53D6\u6B21\u3044\u3067\u3082\u3089\u3046",
      mustSay: [
        "\u304A\u5FD9\u3057\u3044\u3068\u3053\u308D\u6050\u308C\u5165\u308A\u307E\u3059\u3002\u4E00\u822C\u793E\u56E3\u6CD5\u4EBA\u4F01\u696D\u578B\u78BA\u5B9A\u62E0\u51FA\u5E74\u91D1\u76F8\u8AC7\u30BB\u30F3\u30BF\u30FC\u306E\u4F50\u85E4\u3068\u7533\u3057\u307E\u3059\u3002\u9000\u8077\u91D1\u6E96\u5099\u306B\u95A2\u3059\u308B\u4EF6\u3067\u3001\u4EE3\u8868\u306E\u4E2D\u6751\u69D8\u306B\u304A\u7E4B\u304E\u3044\u305F\u3060\u3051\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F"
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
      transition: "\u53D6\u6B21\u304C\u767A\u751F\u3057\u305F\u3089 P1 \u3078\u3002\u5F37\u56FA\u306A\u55B6\u696D\u96FB\u8A71\u62D2\u5426\u306A\u3089 P0X \u3078\u3002",
      allowedNext: ["P0", "P0X", "P1"],
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
        "\u304A\u5FD9\u3057\u3044\u3068\u3053\u308D\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\u3002\u4E00\u822C\u793E\u56E3\u6CD5\u4EBA\u4F01\u696D\u578B\u78BA\u5B9A\u62E0\u51FA\u5E74\u91D1\u76F8\u8AC7\u30BB\u30F3\u30BF\u30FC\u306E\u4F50\u85E4\u3068\u7533\u3057\u307E\u3059\u3002\u7A81\u7136\u306E\u304A\u96FB\u8A71\u5931\u793C\u3044\u305F\u3057\u307E\u3059\u3002",
        "\u539A\u751F\u52B4\u50CD\u7701\u304C\u7BA1\u8F44\u3059\u308B\u9000\u8077\u91D1\u5236\u5EA6\u3001\u4F01\u696D\u578B\u78BA\u5B9A\u62E0\u51FA\u5E74\u91D1\u306B\u3064\u3044\u3066\u306E\u3054\u6848\u5185\u3067\u3059\u3002\u5236\u5EA6\u304C\u539A\u52B4\u7701\u306E\u7BA1\u8F44\u3067\u3001\u79C1\u3069\u3082\u306F\u305D\u306E\u5C0E\u5165\u3092\u652F\u63F4\u3057\u3066\u3044\u308B\u6C11\u9593\u306E\u4E8B\u696D\u8005\u306B\u306A\u308A\u307E\u3059\u3002",
        "\u521D\u3081\u306B1\u70B9\u3060\u3051\u78BA\u8A8D\u306A\u306E\u3067\u3059\u304C\u3001\u5FA1\u793E\u3067\u306F\u5F79\u54E1\u69D8\u306E\u9000\u8077\u91D1\u306E\u3054\u6E96\u5099\u3084\u3001\u793E\u54E1\u69D8\u5411\u3051\u306E\u7A4D\u7ACB\u5236\u5EA6\u306F\u4F55\u304B\u3055\u308C\u3066\u3044\u307E\u3059\u304B\uFF1F"
      ],
      conditional: [],
      principles: [
        "\u3010\u7ACB\u5834\u306E\u5207\u308A\u5206\u3051\u306F\u5FC5\u9808\u3011\u7BA1\u8F44\uFF08\u539A\u52B4\u7701\uFF09\u3068\u81EA\u793E\u306E\u7ACB\u5834\uFF08\u6C11\u9593\u306E\u5C0E\u5165\u652F\u63F4\u4E8B\u696D\u8005\uFF09\u3092\u5FC5\u305A\u540C\u3058\u4E00\u606F\u3067\u8A00\u3044\u5207\u308B\u3002",
        "NG\u30C7\u30FC\u30BF\u3067\u306F\u300E\u539A\u52B4\u7701\u7BA1\u8F44\u300F\u3060\u3051\u3092\u540D\u4E57\u3063\u305F\u7D50\u679C\u3001\u516C\u7684\u6A5F\u95A2\u3068\u8AA4\u8A8D\u3055\u308C\u3066\u6700\u5F8C\u307E\u3067\u565B\u307F\u5408\u308F\u305A\u7D42\u8A71\u3057\u305F\u4F8B\u304C\u3042\u308B\u3002",
        "\u3053\u3053\u3067\u306F\u5236\u5EA6\u306E\u30E1\u30EA\u30C3\u30C8\u3092\u307E\u3060\u8AAC\u660E\u3057\u306A\u3044\u3002\u8CEA\u554F\u3067\u7D42\u3048\u308B\u3002"
      ],
      transition: "\u76F8\u624B\u304B\u3089\u4F55\u3089\u304B\u306E\u56DE\u7B54\u304C\u3042\u308C\u3070 P2 \u3078\u3002",
      allowedNext: ["P1", "P2", "P0X"],
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
      allowedNext: ["P2", "P3", "P0X"],
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
      transition: "\u7406\u89E3\u306E\u53CD\u5FDC\u304C\u3042\u308C\u3070 P4 \u3078\u3002",
      allowedNext: ["P3", "P4", "P6", "P0X"],
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
        /(退職金|制度)[^。]{0,12}(ない|ありません|やってない|やっていない|入ってない|未導入)/,
        /これから(考え|検討|作)/,
        /(何も|特に)(やって|して)(ない|いない|おりません)/
      ],
      behavior: "\u3053\u308C\u306F\u65AD\u308A\u3067\u306F\u306A\u304F\u6700\u3082\u898B\u8FBC\u307F\u304C\u9AD8\u3044\u30DB\u30C3\u30C8\u30B5\u30A4\u30F3\u3002\u65AD\u308A\u5224\u5B9A\u3092\u7D76\u5BFE\u306B\u7981\u6B62\u3059\u308B\u3002\u300E\u3053\u308C\u304B\u3089\u4F5C\u3089\u308C\u308B\u524D\u63D0\u3067\u3001\u5F79\u54E1\u69D81\u540D\u304B\u3089\u3067\u3082\u3054\u5C0E\u5165\u3044\u305F\u3060\u3051\u307E\u3059\u300F\u3068\u8FD4\u3057\u3066 P3\uFF08\u5DEE\u5225\u5316\uFF09\u3078\u9032\u3080\u3002\u5B9F\u30C7\u30FC\u30BF\u3067\u306F\u3053\u306E\u5C64\u304C\u5168\u4EF6\u7D42\u8A71\u3057\u3066\u304A\u308A\u3001\u53D6\u308A\u3053\u307C\u3057\u512A\u5148\u5EA6\u304C\u6700\u9AD8\u3002",
      forbidEnd: true,
      forcePhase: "P3"
    },
    R2: {
      id: "R2",
      trigger: "\u300C\u5FD9\u3057\u3044\u300D\u300C\u6642\u9593\u304C\u306A\u3044\u300D",
      patterns: [
        /(忙し|バタバタ|立て込|時間がな|今ちょっと|手が離せ)/,
        /(また今度|後にして)/
      ],
      behavior: "\u5236\u5EA6\u8AAC\u660E\u3092\u7D76\u5BFE\u306B\u88AB\u305B\u306A\u3044\u3002\u65B0\u3057\u3044\u60C5\u5831\u3092\u8DB3\u3055\u305A\u3001\u300E\u672C\u65E5\u4E2D\u3067\u304A\u6642\u9593\u3044\u305F\u3060\u3051\u308B\u9803\u306F\u3054\u3056\u3044\u307E\u305B\u3093\u304B\uFF1F\u300F\u307E\u305F\u306F P6 \u306E\u4EEE\u62BC\u3055\u3048\u30AF\u30ED\u30FC\u30BA\u306E\u307F\u3092\u884C\u3046\u3002\u5B9F\u30C7\u30FC\u30BF\u3067\u306F\u8AAC\u660E\u3092\u88AB\u305B\u305F\u67B6\u96FB\u306F10\u4EF6\u4EE5\u4E0A\u3059\u3079\u3066\u5207\u3089\u308C\u3066\u3044\u308B\u3002",
      forbidEnd: false,
      forcePhase: "P6"
    },
    R3: {
      id: "R3",
      trigger: "\u300C\u7A0E\u7406\u58EB\u30FB\u793E\u52B4\u58EB\u306B\u4EFB\u305B\u3066\u3044\u308B\u300D",
      patterns: [/(税理士|会計士|社労士|社会保険労務士|顧問)[^。]{0,15}(任せ|お願い|相談|通じ)/],
      behavior: "\u5426\u5B9A\u3057\u306A\u3044\u3002\u300E\u5148\u751F\u306B\u3054\u76F8\u8AC7\u3044\u305F\u3060\u304F\u305F\u3081\u306E\u5224\u65AD\u6750\u6599\u3092\u304A\u6E21\u3057\u3059\u308B\u3068\u3053\u308D\u307E\u3067\u304C\u79C1\u3069\u3082\u306E\u62C5\u5F53\u3067\u3059\u300F\u3068\u8FD4\u3059\u3002\u300E\u7A0E\u7406\u58EB\u306F\u8A73\u3057\u304F\u306A\u3044\u300F\u7B49\u306E\u5C02\u9580\u5BB6\u3092\u4E0B\u3052\u308B\u8868\u73FE\u306F\u53CD\u767A\u3092\u62DB\u304F\u305F\u3081\u7D76\u5BFE\u306B\u7981\u6B62\u3002",
      forbidEnd: true
    },
    R4: {
      id: "R4",
      trigger: "\u300C\u8CC7\u6599\u3060\u3051\u9001\u3063\u3066\u300D",
      patterns: [/(資料|パンフ|案内)[^。]{0,10}(送っ|送付|メール|くださ|ください)/],
      behavior: "\u9001\u4ED8\u3060\u3051\u3067\u7D42\u308F\u3089\u305B\u306A\u3044\u3002\u9001\u4ED8\u624B\u6BB5\u306E\u9078\u629E\u80A2\uFF08SMS / \u30E1\u30FC\u30EB / \u5C01\u66F8\uFF09\u3092\u63D0\u793A\u3057\u3001\u5FC5\u305A\u518D\u67B6\u96FB\u65E5\u306E\u78BA\u5B9A\u3092\u30BB\u30C3\u30C8\u3067\u53D6\u308B\u3002",
      forbidEnd: true
    },
    R5: {
      id: "R5",
      trigger: "\u76F8\u624B\u304C\u516C\u7684\u6A5F\u95A2\u3068\u8AA4\u8A8D\u3057\u3066\u3044\u308B",
      patterns: [
        /(お国|国が|役所|公的|行政|厚労省の方|市役所|年金機構)/,
        /(手数料|費用)[^。]{0,10}(かからん|かからない|無料)/
      ],
      behavior: "\u5373\u5EA7\u306B\u300E\u5236\u5EA6\u306F\u539A\u751F\u52B4\u50CD\u7701\u306E\u7BA1\u8F44\u3067\u3059\u304C\u3001\u79C1\u3069\u3082\u306F\u6C11\u9593\u306E\u5C0E\u5165\u652F\u63F4\u4E8B\u696D\u8005\u3067\u3059\u300F\u3092\u518D\u63D0\u793A\u3059\u308B\u3002\u8AA4\u8A8D\u3092\u653E\u7F6E\u3057\u305F\u307E\u307E\u4F1A\u8A71\u3092\u9032\u3081\u306A\u3044\u3002",
      forbidEnd: true
    },
    R7: {
      id: "R7",
      trigger: "\u5FDC\u5BFE\u8005\u304C\u4EE3\u8868\u3067\u306A\u3044\uFF0F\u6C7A\u88C1\u6A29\u304C\u306A\u3044",
      patterns: [
        /(代表|社長)(は|が)(不在|おりません|席を外|外出|留守)/,
        /(私では|自分では)[^。]{0,10}(分から|わから|決められ|決裁)/
      ],
      behavior: "\u30D2\u30A2\u30EA\u30F3\u30B0\u3092\u7D9A\u3051\u306A\u3044\u3002\u6B21\u56DE\u63A5\u89E6\u6761\u4EF6\uFF08\u4EE3\u8868\u306E\u51FA\u793E\u65E5\u30FB\u7E4B\u304C\u308A\u3084\u3059\u3044\u6642\u9593\u5E2F\uFF09\u306E\u78BA\u5B9A\u3060\u3051\u306B\u5207\u308A\u66FF\u3048\u308B\u3002",
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

  // src/demo/customerScript.ts
  var DEMO_SCRIPT = [
    // ── P0 受付突破 ──
    {
      role: "\u53D7\u4ED8",
      text: "\u306F\u3044\u3001\u682A\u5F0F\u4F1A\u793E\u30B5\u30F3\u30D7\u30EB\u5DE5\u696D\u3067\u3054\u3056\u3044\u307E\u3059\u3002\u3069\u3046\u3044\u3063\u305F\u3054\u7528\u4EF6\u3067\u3057\u3087\u3046\u304B\uFF1F",
      agentSays: "\u4EE3\u8868\u306E\u4E2D\u6751\u69D8\u3054\u81EA\u8EAB\u306E\u9000\u8077\u91D1\u306E\u3054\u6E96\u5099\u306B\u95A2\u3059\u308B\u4EF6\u3067\u3059\u3002\u521D\u3081\u306B1\u70B9\u3060\u3051\u78BA\u8A8D\u306A\u306E\u3067\u3059\u304C\u3001\u5FA1\u793E\u3067\u306F\u5F79\u54E1\u69D8\u306E\u9000\u8077\u91D1\u306E\u3054\u6E96\u5099\u3084\u3001\u793E\u54E1\u69D8\u5411\u3051\u306E\u7A4D\u7ACB\u5236\u5EA6\u306F\u4F55\u304B\u3055\u308C\u3066\u3044\u307E\u3059\u304B\uFF1F"
    },
    {
      role: "\u53D7\u4ED8",
      text: "\u7A4D\u7ACB\u306E\u5236\u5EA6\u3067\u3059\u304B\u2026\u3002\u7279\u306B\u4F55\u3082\u3057\u3066\u3044\u306A\u3044\u3068\u601D\u3044\u307E\u3059\u304C\u3001\u5C11\u3005\u304A\u5F85\u3061\u304F\u3060\u3055\u3044\u3002\u4EE3\u8868\u306B\u4EE3\u308F\u308A\u307E\u3059\u3002",
      agentSilent: true
      // 取次ぎ中。AI は代表が出るまで喋らない。
    },
    { role: "\u4EE3\u8868 \u4E2D\u6751\u69D8", text: "\u306F\u3044\u3001\u304A\u96FB\u8A71\u4EE3\u308F\u308A\u307E\u3057\u305F\u3002\u4E2D\u6751\u3067\u3059\u3002", advanceTo: "P1" },
    // ── P1 → P2 最頻出の断り ──
    {
      role: "\u4EE3\u8868 \u4E2D\u6751\u69D8",
      text: "\u3042\u3042\u3001\u3046\u3061\u3001\u9000\u8077\u91D1\u306F\u4FDD\u967A\u3067\u3084\u3063\u3066\u308B\u306E\u3067\u5927\u4E08\u592B\u3067\u3059\u3088\u3002",
      advanceTo: "P2"
    },
    // ── P2 充足度質問が効いて、相手が不足を口にする ──
    {
      role: "\u4EE3\u8868 \u4E2D\u6751\u69D8",
      text: "\u79C1\u81EA\u8EAB\u306E\u5206\u3067\u3059\u304B\uFF1F\u3046\u30FC\u3093\u2026\u6B63\u76F4\u305D\u3053\u307E\u3067\u8003\u3048\u305F\u3053\u3068\u306A\u304B\u3063\u305F\u3067\u3059\u306D\u3002\u793E\u54E1\u5411\u3051\u306B\u304B\u3051\u3066\u308B\u3082\u306E\u306A\u306E\u3067\u3001\u81EA\u5206\u306E\u5206\u304C\u3069\u3046\u306A\u3063\u3066\u308B\u304B\u306F\u628A\u63E1\u3057\u3066\u306A\u3044\u3067\u3059\u3002",
      advanceTo: "P3"
    },
    // ── P3 差別化 → P4 法改正フック ──
    {
      role: "\u4EE3\u8868 \u4E2D\u6751\u69D8",
      text: "\u3078\u3048\u3001\u7D4C\u8CBB\u3067\u843D\u3068\u305B\u308B\u3093\u3067\u3059\u304B\u3002\u305D\u308C\u306F\u4FDD\u967A\u3068\u306F\u307E\u305F\u5225\u306E\u8A71\u306A\u3093\u3067\u3059\u306D\u3002",
      advanceTo: "P4"
    },
    { role: "\u4EE3\u8868 \u4E2D\u6751\u69D8", text: "\u6765\u5E74\u307E\u305F\u5236\u5EA6\u304C\u5909\u308F\u308B\u3093\u3067\u3059\u304B\u3002\u305D\u308C\u306F\u77E5\u3089\u306A\u304B\u3063\u305F\u306A\u3002", advanceTo: "P5" },
    // ── P5 低ハードル打診 → 多忙・要相談で保留（R2） ──
    {
      role: "\u4EE3\u8868 \u4E2D\u6751\u69D8",
      text: "\u3046\u30FC\u3093\u3001\u8A71\u306F\u5206\u304B\u308B\u3093\u3067\u3059\u304C\u4ECA\u9031\u3061\u3087\u3063\u3068\u30D0\u30BF\u30D0\u30BF\u3057\u3066\u307E\u3057\u3066\u3002\u305D\u308C\u306B\u3001\u3053\u3046\u3044\u3046\u306E\u306F\u59BB\u3068\u3082\u76F8\u8AC7\u3057\u3066\u304B\u3089\u306B\u306A\u308B\u304B\u306A\u3002",
      advanceTo: "P6"
    },
    // ── P6 仮押さえクローズが決まる（★決定打） ──
    {
      role: "\u4EE3\u8868 \u4E2D\u6751\u69D8",
      text: "\u307E\u3042\u3001\u4EEE\u62BC\u3055\u3048\u306A\u3089\u2026\u306F\u3044\u3001\u305D\u308C\u306A\u3089\u5927\u4E08\u592B\u3067\u3059\u3002",
      advanceTo: "P7",
      agentSays: "\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\u3002\u6765\u9031\u3067\u3057\u305F\u3089\u3001\u5348\u524D\u3068\u5348\u5F8C\u3069\u3061\u3089\u304C\u3088\u308D\u3057\u3044\u3067\u3059\u304B\uFF1F"
    },
    // ── P7 日程2択 → 1点確定 ──
    {
      role: "\u4EE3\u8868 \u4E2D\u6751\u69D8",
      text: "\u6765\u9031\u3067\u3059\u306D\u3002\u5348\u524D\u4E2D\u306F\u73FE\u5834\u306B\u51FA\u3066\u3044\u308B\u3053\u3068\u304C\u591A\u3044\u306E\u3067\u3001\u5348\u5F8C\u306E\u65B9\u304C\u3044\u3044\u304B\u306A\u3002",
      agentSays: "\u3067\u306F9\u670817\u65E5\uFF08\u6C34\uFF0914\u6642\u304B\u308930\u5206\u3067\u3044\u304B\u304C\u3067\u3057\u3087\u3046\u304B\uFF1F"
    },
    {
      role: "\u4EE3\u8868 \u4E2D\u6751\u69D8",
      text: "17\u65E5\u306E14\u6642\u306D\u3001\u5927\u4E08\u592B\u3067\u3059\u3002\u3042\u3001\u3061\u306A\u307F\u306B Zoom \u3063\u3066\u4F55\u3067\u3059\u304B\uFF1F\u30D1\u30BD\u30B3\u30F3\u3042\u307E\u308A\u8A73\u3057\u304F\u306A\u304F\u3066\u3002",
      provides: { appointment_date: "9\u670817\u65E5\uFF08\u6C34\uFF09", appointment_time: "14\u6642" },
      agentSays: "\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\u3002Zoom \u306F\u30AA\u30F3\u30E9\u30A4\u30F3\u306E\u4F1A\u8B70\u30B7\u30B9\u30C6\u30E0\u3067\u3001\u30B9\u30DE\u30FC\u30C8\u30D5\u30A9\u30F3\u3067\u3082\u53C2\u52A0\u3067\u304D\u307E\u3059\u3002\u30E1\u30FC\u30EB\u3067\u304A\u9001\u308A\u3059\u308B URL \u3092\u30BF\u30C3\u30D7\u3044\u305F\u3060\u304F\u3060\u3051\u3067\u3059\u3002"
    },
    {
      role: "\u4EE3\u8868 \u4E2D\u6751\u69D8",
      text: "\u306A\u308B\u307B\u3069\u3001\u30B9\u30DE\u30DB\u3067URL\u3092\u30BF\u30C3\u30D7\u3059\u308B\u3060\u3051\u306A\u3089\u3067\u304D\u305D\u3046\u3067\u3059\u300230\u5206\u3067\u3059\u306D\u3001\u308F\u304B\u308A\u307E\u3057\u305F\u3002",
      provides: { zoom_agreed: true, duration_agreed: true },
      advanceTo: "P8"
    },
    // ── P8 ヒアリング7項目 ──
    { role: "\u4EE3\u8868 \u4E2D\u6751\u69D8", text: "\u306F\u3044\u3001\u5927\u4E08\u592B\u3067\u3059\u3088\u3002\u3069\u3046\u305E\u3002" },
    {
      role: "\u4EE3\u8868 \u4E2D\u6751\u69D8",
      text: "iDeCo \u306F\u3084\u3063\u3066\u306A\u3044\u3067\u3059\u306D\u3002\u6295\u8CC7\u3082\u7279\u306B\u306F\u3084\u3063\u3066\u3044\u307E\u305B\u3093\u3002",
      provides: { H1: "iDeCo\u30FB\u6295\u8CC7\u3068\u3082\u306B\u306A\u3057" }
    },
    {
      role: "\u4EE3\u8868 \u4E2D\u6751\u69D8",
      text: "\u9000\u8077\u91D1\u5236\u5EA6\u306F\u2026\u3055\u3063\u304D\u304A\u8A71\u3057\u3057\u305F\u4FDD\u967A\u3060\u3051\u3067\u3059\u306D\u3002\u3042\u3068\u79C1\u306E\u5E74\u9F62\u306F\u3001\u4ECA\u5E74\u306756\u306B\u306A\u308A\u307E\u3059\u3002",
      provides: { H2: "\u4FDD\u967A\uFF08\u751F\u547D\u4FDD\u967A\uFF09\u306E\u307F", H3: "56\u6B73" }
    },
    {
      role: "\u4EE3\u8868 \u4E2D\u6751\u69D8",
      text: "\u5F79\u54E1\u306F\u79C1\u3068\u59BB\u306E2\u540D\u3067\u3059\u3002\u59BB\u306F52\u3067\u3059\u306D\u3002",
      provides: { H4: "2\u540D\uFF08\u4EE3\u886856\u6B73\u30FB\u914D\u5076\u800552\u6B73\uFF09" }
    },
    {
      role: "\u4EE3\u8868 \u4E2D\u6751\u69D8",
      text: "\u793E\u4F1A\u4FDD\u967A\u306F\u2026\u30D1\u30FC\u30C8\u3092\u9664\u3044\u306610\u540D\u304F\u3089\u3044\u304B\u306A\u300210\u540D\u3067\u3059\u3002",
      provides: { H5: "10\u540D" }
    },
    {
      role: "\u4EE3\u8868 \u4E2D\u6751\u69D8",
      text: "\u6C7A\u3081\u308B\u306E\u306F\u79C1\u3067\u3059\u306D\u3002\u3042\u3068\u6C7A\u7B97\u306F3\u6708\u3067\u3059\u3002",
      provides: { H6: "\u4EE3\u8868\u306E\u5224\u65AD\u3067\u6C7A\u88C1\u53EF\u80FD", H7: "3\u6708" }
    },
    {
      role: "\u4EE3\u8868 \u4E2D\u6751\u69D8",
      text: "\u30E1\u30FC\u30EB\u306F nakamura@sample-kogyo.co.jp \u3067\u3059\u3002",
      provides: { email: "nakamura@sample-kogyo.co.jp" }
    },
    { role: "\u4EE3\u8868 \u4E2D\u6751\u69D8", text: "\u306F\u3044\u3001\u305D\u308C\u3067\u5408\u3063\u3066\u3044\u307E\u3059\u3002", provides: { email_confirmed: true } },
    {
      role: "\u4EE3\u8868 \u4E2D\u6751\u69D8",
      text: "\u524D\u65E5\u306E\u9023\u7D61\u306F\u643A\u5E2F\u306B\u304F\u3060\u3055\u3044\u3002090-1234-5678 \u3067\u3059\u3002\u5348\u524D\u4E2D\u304C\u3064\u306A\u304C\u308A\u3084\u3059\u3044\u3067\u3059\u3002",
      provides: { callback_phone: "090-1234-5678", callback_window: "\u5348\u524D\u4E2D" },
      advanceTo: "P9"
    },
    // ── P9 締め ──
    {
      role: "\u4EE3\u8868 \u4E2D\u6751\u69D8",
      text: "\u30AB\u30EC\u30F3\u30C0\u30FC\u306B\u5165\u308C\u3066\u304A\u304D\u307E\u3059\u306D\u3002\u306F\u3044\u3001\u5F53\u65E5\u306F\u3088\u308D\u3057\u304F\u304A\u9858\u3044\u3057\u307E\u3059\u3002",
      advanceTo: "END"
    }
  ];

  // src/demo/mockEngine.ts
  var CONTACT_QUESTIONS = {
    \u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9: () => "\u4F1A\u793E\u6982\u8981\u3068 Zoom \u306E URL \u3092\u304A\u9001\u308A\u3057\u305F\u3044\u306E\u3067\u3059\u304C\u3001\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3092\u4F3A\u3048\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F",
    \u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u306E\u5FA9\u5531\u78BA\u8A8D: (s) => `\u5FA9\u5531\u3055\u305B\u3066\u3044\u305F\u3060\u304D\u307E\u3059\u3002${s.email} \u3067\u304A\u9593\u9055\u3044\u306A\u3044\u3067\u3057\u3087\u3046\u304B\uFF1F`,
    \u524D\u65E5\u78BA\u8A8D\u306E\u9023\u7D61\u5148: () => "\u524D\u65E5\u306B\u78BA\u8A8D\u306E\u3054\u9023\u7D61\u3092\u5DEE\u3057\u4E0A\u3052\u305F\u3044\u306E\u3067\u3059\u304C\u3001\u304A\u96FB\u8A71\u756A\u53F7\u3092\u4F3A\u3048\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F",
    \u524D\u65E5\u9023\u7D61\u306E\u5E0C\u671B\u6642\u9593\u5E2F: () => "\u524D\u65E5\u306E\u3054\u9023\u7D61\u306F\u3001\u4F55\u6642\u9803\u304C\u7E4B\u304C\u308A\u3084\u3059\u3044\u3067\u3057\u3087\u3046\u304B\uFF1F"
  };
  function mockUtterance(state2, scripted) {
    const strip = (m) => m.replace(/^（[^）]*）/, "");
    if (scripted) return scripted;
    if (state2.phase === "P8") {
      const alreadyInP8 = state2.turns.some((t) => t.speaker === "agent" && t.phase === "P8");
      if (!alreadyInP8) return strip(PHASES.P8.mustSay[0] ?? "");
      const nextH = missingHearing(state2)[0];
      if (nextH) return HEARING_SLOT_MAP.get(nextH)?.question ?? "";
      const nextC = missingContact(state2)[0];
      if (nextC) return CONTACT_QUESTIONS[nextC]?.(state2) ?? `${nextC}\u3092\u4F3A\u3048\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F`;
    }
    return PHASES[state2.phase].mustSay.map(strip).join(" ");
  }
  var MockCallEngine = class {
    constructor(state2, script = DEMO_SCRIPT) {
      this.state = state2;
      this.script = script;
    }
    state;
    script;
    scriptIndex = 0;
    pendingAdvance = null;
    pendingAgentSays = null;
    get finished() {
      return this.state.ended || this.state.turns.length >= 80;
    }
    /** 台本の進捗（0〜1）。 */
    get progress() {
      return this.script.length === 0 ? 1 : this.scriptIndex / this.script.length;
    }
    step() {
      if (this.finished) return null;
      const state2 = this.state;
      let overrideReason;
      if (this.pendingAdvance) {
        const t = resolveTransition(state2, this.pendingAdvance, [], []);
        overrideReason = t.overrideReason;
        state2.phase = t.phase;
        this.pendingAdvance = null;
        if (state2.phase === "END") {
          state2.ended = true;
          return { agent: { text: "", phase: "END" }, customer: [], overrideReason, ended: true };
        }
      }
      const phase = state2.phase;
      const text = mockUtterance(state2, this.pendingAgentSays);
      applyExtracted(state2, {
        calendar_requested: /カレンダー/.test(text),
        law_change_hook_used: /(法改正|62,?000円)/.test(text)
      });
      state2.turns.push({ index: state2.turns.length, speaker: "agent", text, phase });
      const customer = [];
      this.pendingAgentSays = null;
      for (; ; ) {
        const line = this.script[this.scriptIndex];
        if (!line) break;
        this.scriptIndex++;
        if (line.provides) applyExtracted(state2, line.provides);
        const guardrails = detectGuardrails(line.text);
        for (const g of guardrails) {
          if (!state2.firedGuardrails.includes(g)) state2.firedGuardrails.push(g);
        }
        state2.turns.push({
          index: state2.turns.length,
          speaker: "customer",
          text: line.text,
          phase: state2.phase,
          guardrails
        });
        customer.push({ role: line.role, text: line.text, guardrails });
        if (line.advanceTo) this.pendingAdvance = line.advanceTo;
        if (line.agentSays) this.pendingAgentSays = line.agentSays;
        if (!line.agentSilent) break;
      }
      if (customer.length === 0 && !this.pendingAdvance) state2.ended = true;
      return { agent: { text, phase }, customer, overrideReason, ended: state2.ended };
    }
  };

  // src/demo/scenario.ts
  var DEMO_SCENARIO = {
    agentOrg: "\u4E00\u822C\u793E\u56E3\u6CD5\u4EBA\u4F01\u696D\u578B\u78BA\u5B9A\u62E0\u51FA\u5E74\u91D1\u76F8\u8AC7\u30BB\u30F3\u30BF\u30FC",
    agentName: "\u4F50\u85E4",
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

  // src/web/main.ts
  var $ = (id) => {
    const el2 = document.getElementById(id);
    if (!el2) throw new Error(`#${id} \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093`);
    return el2;
  };
  var state = createCallState();
  var engine = new MockCallEngine(state);
  var playTimer = null;
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== void 0) node.textContent = text;
    return node;
  }
  function renderScenario() {
    const s = DEMO_SCENARIO;
    $("scenario").textContent = `\u67B6\u96FB\u5148: ${s.companyName}\uFF08\u5F93\u696D\u54E1${s.employeeCount}\u540D\u30FB\u5F79\u54E1${s.officerCount}\u540D\uFF09 \uFF0F \u76F8\u624B: ${s.contactTitle} ${s.contactName}\u69D8 \uFF0F \u30B4\u30FC\u30EB: ${s.proposedDate} ${s.proposedTime} \u306E Zoom \u5546\u8AC7\uFF08${s.meetingMinutes}\u5206\uFF09\u78BA\u5B9A\uFF0B\u30D2\u30A2\u30EA\u30F3\u30B07\u9805\u76EE\u53D6\u5F97`;
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
    $("compliance").textContent = `\u76F8\u624B\u306B\u5C4A\u3044\u305F\u7981\u6B62\u8868\u73FE: 0 \u4EF6\uFF08\u51FA\u529B\u524D\u30D5\u30A3\u30EB\u30BF\u3067\u767A\u8A71\u524D\u306B\u906E\u65AD ${state.blockedViolationCount} \u4EF6\uFF09\u3002\u30E2\u30C3\u30AF\u30E2\u30FC\u30C9\u306E\u305F\u3081\u767A\u8A71\u306F\u8A2D\u8A08\u66F8\u306E\u5B9A\u578B\u6587\u3067\u3001\u751F\u6210\u524D\u5236\u7D04\u304C\u52B9\u3044\u3066\u3044\u308B\u72B6\u614B\u3067\u3059\u3002`;
  }
  function renderAll() {
    renderSteps();
    renderHearing();
    renderDod();
    renderGuardrails();
    $("progress").textContent = state.ended ? "\u901A\u8A71\u7D42\u4E86" : `\u53F0\u672C ${Math.round(engine.progress * 100)}%`;
    $("next").disabled = state.ended;
    $("play").disabled = state.ended;
  }
  var transcript = () => $("transcript");
  function clearTranscript() {
    transcript().innerHTML = '<div class="empty">\u300C\u6B21\u306E\u30BF\u30FC\u30F3\u300D\u3067\u67B6\u96FB\u3092\u958B\u59CB\u3057\u307E\u3059</div>';
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
  }
  function pushFlag(text) {
    const d = el("div", "flag", text);
    transcript().append(d);
  }
  function scrollToEnd() {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }
  function speak(text) {
    const on = $("voice").checked;
    if (!on || !("speechSynthesis" in window) || !text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  }
  var lastPhase = null;
  function step() {
    const s = engine.step();
    if (!s) {
      stopPlay();
      renderAll();
      return;
    }
    if (transcript().querySelector(".empty")) transcript().innerHTML = "";
    if (s.overrideReason) pushFlag(`\u26A0 \u9077\u79FB\u3092\u5374\u4E0B: ${s.overrideReason}`);
    if (s.agent.text) {
      if (s.agent.phase !== lastPhase) {
        pushPhaseSeparator(s.agent.phase);
        lastPhase = s.agent.phase;
      }
      pushMessage("ai", "AI", s.agent.text);
      speak(s.agent.text);
    }
    for (const c of s.customer) {
      pushMessage("cust", c.role, c.text);
      if (c.guardrails.length > 0) {
        pushFlag(
          `\u30AC\u30FC\u30C9\u30EC\u30FC\u30EB\u691C\u77E5: ${c.guardrails.map((g) => `${g}\uFF08${GUARDRAILS[g].trigger}\uFF09`).join(" / ")}`
        );
      }
    }
    renderAll();
    scrollToEnd();
    if (state.ended) stopPlay();
  }
  function stopPlay() {
    if (playTimer !== null) {
      clearInterval(playTimer);
      playTimer = null;
    }
    $("play").textContent = "\u23E9 \u81EA\u52D5\u518D\u751F";
  }
  function togglePlay() {
    if (playTimer !== null) {
      stopPlay();
      return;
    }
    $("play").textContent = "\u23F8 \u505C\u6B62";
    step();
    playTimer = window.setInterval(step, 2600);
  }
  function reset() {
    stopPlay();
    window.speechSynthesis?.cancel();
    state = createCallState();
    engine = new MockCallEngine(state);
    lastPhase = null;
    clearTranscript();
    renderAll();
    window.scrollTo({ top: 0 });
  }
  renderScenario();
  renderAll();
  $("next").addEventListener("click", () => {
    stopPlay();
    step();
  });
  $("play").addEventListener("click", togglePlay);
  $("reset").addEventListener("click", reset);
})();
