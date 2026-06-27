const PLAN_LIMITS = {
  ubuntu: { maxExams: 1, cooldownMs: 0, singleAttempt: true, label: 'Ubuntu Free' },
  inshuro2: { maxExams: 2, cooldownMs: 0, singleAttempt: false, label: 'Inshuro 2' },
  inshuro5: { maxExams: 5, cooldownMs: 0, singleAttempt: false, label: 'Icyumweru' },
  ukwezi: { maxExams: 999, cooldownMs: 2 * 60 * 1000, singleAttempt: false, label: 'Ukwezi' }
};

function normalizePlan(plan) {
  if (!plan) return 'ubuntu';
  if (plan === 'icyumweru' || plan === 'inshuro5') return 'inshuro5';
  if (plan === 'inshuro2') return 'inshuro2';
  if (plan === 'ukwezi') return 'ukwezi';
  if (PLAN_LIMITS[plan]) return plan;
  return 'ubuntu';
}

function getCompletedExamCount(exams = []) {
  return Array.isArray(exams) ? exams.length : 0;
}

function buildAccessState({ user, exams = [], now = Date.now() }) {
  const plan = normalizePlan(user?.subscription_plan);
  const info = PLAN_LIMITS[plan] || PLAN_LIMITS.ubuntu;
  const completed = getCompletedExamCount(exams);
  const remainingExams = info.maxExams >= 999 ? 999 : Math.max(0, info.maxExams - completed);
  const lastCompletedAt = Array.isArray(exams) && exams.length > 0
    ? Date.parse(exams[0].created_at || exams[0].date || 0) || 0
    : 0;
  const cooldownRemainingMs = info.cooldownMs > 0 && lastCompletedAt
    ? Math.max(0, info.cooldownMs - (now - lastCompletedAt))
    : 0;
  const canStartExamNow = cooldownRemainingMs === 0;
  const canStartMoreExams = info.maxExams >= 999 || remainingExams > 0;

  return {
    plan,
    planLabel: info.label,
    maxExamsAllowed: info.maxExams >= 999 ? 999 : info.maxExams,
    completedExamCount: completed,
    remainingExams,
    cooldownRemainingMs,
    canStartExamNow,
    canStartMoreExams,
    isApproved: user?.subscription_status === 'approved',
    isPaid: Number(user?.subscription_amount || 0) > 0
  };
}

export { PLAN_LIMITS, normalizePlan, buildAccessState };
