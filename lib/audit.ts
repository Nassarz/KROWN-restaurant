import { db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';

export const logAudit = async (userEmail: string, action: string, details: any) => {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      userEmail,
      action,
      details,
      timestamp: Date.now()
    });
  } catch (e) {
    console.error('Failed to write audit log', e);
  }
};
