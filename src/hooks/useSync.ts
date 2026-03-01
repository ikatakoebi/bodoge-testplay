import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { registerSyncHandlers, useSyncStore } from '../store/syncStore';

// ゲーム状態とSocket.io同期を橋渡しするフック
export function useSync() {
  useEffect(() => {
    registerSyncHandlers(
      // アクションベース受信（将来用、現在はフル状態同期）
      () => {},
      // フル状態受信
      (state) => {
        useGameStore.setState(state);
      }
    );
  }, []);

  // gameStoreの変更を監視して同期
  useEffect(() => {
    const unsubscribe = useGameStore.subscribe((state, prevState) => {
      const sync = useSyncStore.getState();
      if (!sync.roomId || sync.isRemoteAction) return;

      // 主要な状態が変わったらフル状態送信
      if (
        state.cardInstances !== prevState.cardInstances ||
        state.cardStacks !== prevState.cardStacks ||
        state.counters !== prevState.counters ||
        state.areas !== prevState.areas ||
        state.cardDefinitions !== prevState.cardDefinitions ||
        state.players !== prevState.players
      ) {
        sync.sendFullState({
          cardInstances: state.cardInstances,
          cardStacks: state.cardStacks,
          cardDefinitions: state.cardDefinitions,
          cardTemplates: state.cardTemplates,
          areas: state.areas,
          counters: state.counters,
          players: state.players,
          logs: state.logs,
        });
      }
    });

    return () => unsubscribe();
  }, []);
}
