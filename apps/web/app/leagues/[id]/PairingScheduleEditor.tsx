"use client";
import { useLanguage } from "../../contexts/LanguageContext";
import ScheduleEditor from "../../components/competition/ScheduleEditor";

/**
 * Date prévisionnelle d'une rencontre de ligue : les deux coachs (ou le
 * commissaire) posent la date convenue, qui fait passer la rencontre de
 * « À jouer » à « Prévu le … ». Enveloppe de l'éditeur commun
 * (`components/competition/ScheduleEditor`) avec les libellés i18n et
 * l'endpoint `PATCH /leagues/pairings/:id/schedule` (`null` retire la date).
 */
interface PairingScheduleEditorProps {
  pairingId: string;
  scheduledAt: string | null;
  /** Rappelé après une écriture réussie (rechargement de la saison). */
  onChanged: () => void;
}

export function PairingScheduleEditor({
  pairingId,
  scheduledAt,
  onChanged,
}: PairingScheduleEditorProps) {
  const { t } = useLanguage();
  return (
    <ScheduleEditor
      id={pairingId}
      endpoint={`/leagues/pairings/${pairingId}/schedule`}
      scheduledAt={scheduledAt}
      testIdBase="pairing-schedule"
      onChanged={onChanged}
      labels={{
        label: t.leagues.pairingScheduleLabel,
        open: t.leagues.pairingScheduleButton,
        edit: t.leagues.pairingScheduleEdit,
        save: t.leagues.pairingScheduleSave,
        clear: t.leagues.pairingScheduleClear,
        cancel: t.leagues.pairingScheduleCancel,
        invalid: t.leagues.pairingScheduleInvalid,
        error: t.leagues.pairingScheduleError,
      }}
    />
  );
}
