import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { db, getCurrentUserUid, isFirebaseConfigured } from './firebase';

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

  const uid = getCurrentUserUid();

  if (!uid) {
    onData([]);
    return () => {};
  }

  const archiveQuery = query(
    getUserArchiveCollection(uid),
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

  const uid = getCurrentUserUid();

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


export async function deleteArchivedGame(gameId) {
  if (!isFirebaseConfigured || !db) {
    return null;
  }

  const uid = getCurrentUserUid();

  if (!uid) {
    throw new Error('No authenticated Firebase user available for archive delete.');
  }

  return deleteDoc(doc(db, USERS_COLLECTION, uid, ARCHIVE_COLLECTION, gameId));
}
