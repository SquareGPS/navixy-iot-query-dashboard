import {
  Activity,
  DollarSign,
  Radio,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { OnboardingRoleId } from './types';

export const ROLE_ICONS: Record<OnboardingRoleId, LucideIcon> = {
  'fleet-manager': Truck,
  'operations-manager': Activity,
  dispatcher: Radio,
  'maintenance-manager': Wrench,
  'finance-manager': DollarSign,
  'partner-admin': Users,
};

export const ROLE_COLORS: Record<OnboardingRoleId, string> = {
  'fleet-manager': 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  'operations-manager': 'from-violet-500/20 to-violet-600/10 border-violet-500/30',
  dispatcher: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
  'maintenance-manager': 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
  'finance-manager': 'from-rose-500/20 to-rose-600/10 border-rose-500/30',
  'partner-admin': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
};
