/**
 * Web Speech API（SpeechRecognition）のラッパー。
 *
 * 標準の lib.dom には型が無く、実装も webkit 接頭辞付きのため、
 * 必要な範囲だけをここで型定義して吸収する。
 * 対応状況: Chrome / Edge / Safari。Firefox は未対応（起動時に判定して伝える）。
 */

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResultLike {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onspeechend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function ctor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const micSupported = (): boolean => ctor() !== null;

/** エラーコードを利用者に見せる日本語に変換する。 */
export function micErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "マイクの使用が許可されていません。ブラウザのアドレスバーからマイクを許可してください。";
    case "no-speech":
      return "音声が検出されませんでした。もう一度お試しください。";
    case "audio-capture":
      return "マイクが見つかりません。入力デバイスを確認してください。";
    case "network":
      return "音声認識サーバに接続できませんでした。ネットワークを確認してください。";
    case "aborted":
      return "音声入力を中止しました。";
    default:
      return `音声認識でエラーが発生しました（${code}）。`;
  }
}

export interface MicHandlers {
  /** 認識途中の暫定テキスト（画面に薄く出す用） */
  onInterim?: (text: string) => void;
  /** 確定したテキスト */
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd?: () => void;
}

/**
 * 1回分の音声入力。
 * 押して話す → 話し終わりを検出して自動で確定する運用を想定している。
 */
export class MicInput {
  private rec: SpeechRecognitionLike | null = null;
  private finalText = "";

  get listening(): boolean {
    return this.rec !== null;
  }

  start(handlers: MicHandlers): void {
    const C = ctor();
    if (!C) {
      handlers.onError("このブラウザは音声認識に対応していません（Chrome / Edge / Safari をお使いください）。");
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
  stop(): void {
    this.rec?.stop();
  }

  /** 破棄する（結果は使わない）。 */
  abort(): void {
    const r = this.rec;
    this.rec = null;
    r?.abort();
  }
}
