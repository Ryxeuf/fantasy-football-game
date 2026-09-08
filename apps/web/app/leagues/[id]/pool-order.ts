/**
 * Ordre d'affichage des poules : celle du coach connecté d'abord.
 *
 * Un coach inscrit vient d'abord voir SA poule (son calendrier, son
 * classement). Les autres poules gardent leur ordre d'origine (celui du
 * commissaire), et sans poule préférée l'ordre n'est jamais modifié.
 * Pur et stable : sert au classement par poule comme au groupement du
 * calendrier.
 */
export function putPoolFirst<T>(
  items: readonly T[],
  poolIdOf: (item: T) => string | null | undefined,
  preferredPoolId: string | null | undefined,
): T[] {
  if (!preferredPoolId) return [...items];
  const mine: T[] = [];
  const others: T[] = [];
  for (const item of items) {
    if (poolIdOf(item) === preferredPoolId) mine.push(item);
    else others.push(item);
  }
  return [...mine, ...others];
}
