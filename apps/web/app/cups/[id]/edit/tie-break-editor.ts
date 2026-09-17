/**
 * Les deux opérations de la liste ordonnée vivent dans
 * `app/components/tie-break-order` : elles sont identiques pour une coupe
 * et pour une ligue. Ce module n'est plus qu'un alias, gardé pour les
 * appelants (et le test) existants.
 */
export { moveRule, toggleRule } from "../../../components/tie-break-order";
