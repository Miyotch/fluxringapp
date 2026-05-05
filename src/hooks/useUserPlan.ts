import { useEffect, useState } from 'react';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { initFirebase } from '../services/firebase';
import { useAuth } from './useAuth';

export type PlanId = 'free' | 'standard' | 'premium';

export interface UserPlan {
  planId: PlanId;
  planName: string;
  isAdmin: boolean;
  needsUsername: boolean;
  loading: boolean;
}

const PLAN_NAMES: Record<PlanId, string> = {
  free: 'フリープラン',
  standard: 'スタンダード（¥980/月）',
  premium: 'プレミアム（¥2,980/月）',
};

const VALID_PLANS: PlanId[] = ['free', 'standard', 'premium'];

export function useUserPlan(): UserPlan {
  const { user } = useAuth();
  const [planId, setPlanId] = useState<PlanId>('free');
  const [isAdmin, setIsAdmin] = useState(false);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPlanId('free');
      setIsAdmin(false);
      setNeedsUsername(false);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(getFirestore(initFirebase()), 'users', user.uid),
      (snap) => {
        const data = snap.data();
        const raw = data?.user_type ?? 'free';
        const id = VALID_PLANS.includes(raw) ? (raw as PlanId) : 'free';
        setPlanId(id);
        setIsAdmin(data?.admin === true);
        setNeedsUsername(!data?.displayName);
        setLoading(false);
      },
      () => {
        setPlanId('free');
        setIsAdmin(false);
        setNeedsUsername(false);
        setLoading(false);
      },
    );
    return unsub;
  }, [user]);

  return { planId, planName: PLAN_NAMES[planId], isAdmin, needsUsername, loading };
}
