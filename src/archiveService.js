import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { db, ensureAnonymousAuth, getCurrentUserUid, isFirebaseConfigured } from './firebase';

const USERS_COLLECTION = 'users';
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

function getUserArchiveCollection(uid) {
  return collection(db, USERS_COLLECTION, uid, ARCHIVE_COLLECTION);
}

export function subscribeToArchivedGames(onData, onError) {
  if (!isFirebaseConfigured || !db) {
    onData([]);
    return () => {};
  }

  let unsubscribe = () => {};
  let active = true;

  ensureAnonymousAuth()
    .then((user) => {
      if (!active) return;

      const uid = user?.uid || getCurrentUserUid();
      if (!uid) {
        onData([]);
        return;
      }

      const archiveQuery = query(
        getUserArchiveCollection(uid),
        orderBy('createdAtMs', 'desc'),
        limit(100),
      );

      unsubscribe = onSnapshot(
        archiveQuery,
        (snapshot) => {
          onData(snapshot.docs.map(mapGame));
        },
        (error) => {
          onError?.(error);
        },
      );
    })
    .catch((error) => {
      if (!active) return;
      onError?.(error);
      onData([]);
    });

  return () => {
    active = false;
    unsubscribe();
  };
}

export async function saveArchivedGame(game) {
  if (!isFirebaseConfigured || !db) {
    return null;
  }

  const user = await ensureAnonymousAuth();
  const uid = user?.uid || getCurrentUserUid();

  if (!uid) {
    throw new Error('No authenticated Firebase user available for archive save.');
  }

  const payload = {
    winner: game.winner,
    createdAtIso: game.createdAt,
    createdAtMs: game.createdAtMs,
    roundCount: game.roundCount,
    ownerUid: uid,
    players: game.players.map((player) => ({
      name: player.name,
      score: Number(player.score) || 0,
    })),
  };

  return addDoc(getUserArchiveCollection(uid), payload);
}
