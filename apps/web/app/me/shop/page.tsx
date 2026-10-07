import { redirect } from "next/navigation";
import { SHOP_CATEGORIES } from "./categories";

/**
 * `/me/shop` ouvre la première catégorie. Les flags se lisent côté client :
 * une catégorie fermée y affiche son propre message, et l'en-tête annonce
 * une boutique fermée quand aucune ne l'est.
 */
export default function ShopIndexPage() {
  redirect(SHOP_CATEGORIES[0].href);
}
