import { useEffect, useState } from 'react';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from './useAuth';

export type PlanId = 'free' | 'standard' | 'premium';

export interface UserPlan {
  planId: PlanId;
  planName: string;
  isAdmin: boolean;
  loading: boolean;
}

const PLAN_NAMES: Record<PlanId, string> = {
  free: 'フリープラン',
  standard: 'スタンダード（¥980/月）',
  premium: 'プレミアム（¥2,980/月）',
};

export function useUserPlan(): UserPlan {
  const { user } = useAuth();
  const [planId, setPlanId] = useState<PlanId>('standard');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPlanId('standard');
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(getFirestore(), 'users', user.uid),
      (snap) => {
        const data = snap.data();
        const raw = data?.plan ?? data?.planId ?? 'standard';
        const id = (['free', 'standard', 'premium'] as PlanId[]).includes(raw)
          ? (raw as PlanId)
          : 'standard';
        setPlanId(id);
        setIsAdmin(data?.admin === true);
        setLoading(false);
      },
      () => {
        setPlanId('standard');
        setIsAdmin(false);
        setLoading(false);
      },
    );
    return unsub;
  }, [user]);

  return { planId, planName: PLAN_NAMES[planId], isAdmin, loading };
}
