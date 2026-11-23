import { AssetLoadEntry, HudSnapshot, QuizQuestion } from './types/gameTypes';

type Listener<T> = (payload: T) => void;

interface BridgeEvents {
  'hud:update': HudSnapshot;
  'assets:report': AssetLoadEntry[];
  'assets:error': { key: string; path: string; message: string };
  'game:ready': { scene: string };
  'game:pause-requested': undefined;
  'game:resume-requested': undefined;
  'game:restart-requested': undefined;
  'game:respawn-checkpoint': undefined;
  'game:start-level': { levelId: string };
  'game:enter-menu': undefined;
  'game:retry-load': { levelId: string };
  'loading:error': { message: string; levelId: string };
  'question:open': { boxId: string; question: QuizQuestion };
  'question:resolved': {
    boxId: string;
    questionId?: string;
    isCorrect: boolean;
    rewardScore: number;
    answerPayload?: string;
  };
}

class TypedGameBridge {
  private listeners = new Map<keyof BridgeEvents, Set<Listener<unknown>>>();

  public on<K extends keyof BridgeEvents>(
    event: K,
    cb: Listener<BridgeEvents[K]>
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(cb as Listener<unknown>);
    return () => {
      set?.delete(cb as Listener<unknown>);
    };
  }

  public emit<K extends keyof BridgeEvents>(
    event: K,
    ...args: BridgeEvents[K] extends undefined ? [] : [BridgeEvents[K]]
  ): void {
    const set = this.listeners.get(event);
    if (!set) return;
    const payload = args[0] as BridgeEvents[K];
    set.forEach((cb) => {
      (cb as Listener<BridgeEvents[K]>)(payload);
    });
  }
}

export const GameBridge = new TypedGameBridge();
