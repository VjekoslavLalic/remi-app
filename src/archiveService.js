import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

const ARCHIVE_COLLECTION = 'remiArchive';

function mapGame(doc) {
  const data = doc.data();

  return {
    id: doc.id,
    winner: data.winner || 'Unknown',
    createdAt: data.createdAtIso || new Date(data.createdAtMs || Date.now()).toISOString(),
    createdAtMs: data.createdAtMs || Date.now(),
    roundCount: data.roundCount || 0,
    players: Array.isArray(data.players) ? data.players : [],
  };
}

export function subscribeToArchivedGames(onData, onError) {
  if (!isFirebaseConfigured || !db) {
    onData([]);
    return () => {};
  }

  const archiveQuery = query(
    collection(db, ARCHIVE_COLLECTION),
    orderBy('createdAtMs', 'desc'),
    limit(100),
  );

  return onSnapshot(
    archiveQuery,
    (snapshot) => {
      onData(snapshot.docs.map(mapGame));
    },
    (error) => {
      onError?.(error);
    },
  );
}

export async function saveArchivedGame(game) {
  if (!isFirebaseConfigured || !db) {
    return null;
  }

  const payload = {
    winner: game.winner,
    createdAtIso: game.createdAt,
    createdAtMs: game.createdAtMs,
    roundCount: game.roundCount,
    players: game.players.map((player) => ({
      name: player.name,
      score: Number(player.score) || 0,
    })),
  };

  return addDoc(collection(db, ARCHIVE_COLLECTION), payload);
}
